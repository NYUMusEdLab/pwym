import json
from ctor.continuator import Continuator2
from ctor.constraints import ConstraintProblem
from midi_stuff.mini_muse import Note
models={}
memories={}
def reset(channel):
    models[channel]=Continuator2(kmax=4,seed=7,cache_bytes=8*1024*1024)
    memories[channel]=[]
for channel in ['impro','compo']: reset(channel)
def convert(raw):
    if not 1<=len(raw)<=256: raise ValueError('Play 1–256 notes.')
    result=[]
    for r in raw:
        pitch=int(r['pitch']); velocity=int(r.get('velocity',90)); start=float(r['start']); duration=float(r['duration'])
        if not (0<=pitch<=127 and 1<=velocity<=127 and 0<=start<300 and .01<=duration<=30): raise ValueError('Invalid note range')
        result.append(Note(pitch,velocity,duration*2,start_time=start*2))
    result.sort(key=lambda n:n.start_time)
    base=result[0].start_time
    for n in result: n.start_time-=base
    for i,n in enumerate(result):
        n.next_start_delta=result[i+1].start_time-n.get_end_time() if i+1<len(result) else 0
        n.overlaps_left_flag=any(prev.get_end_time()>n.start_time for prev in result[:i])
    return result

def exchange(payload):
    p=json.loads(payload); ch=p.get('channel','impro')
    if ch not in models: raise ValueError('Unknown memory')
    action=p.get('action','generate')
    if action=='clear':
        reset(ch); return json.dumps({'notes':[],'phrases':0,'message':'Memory cleared.'})
    if action=='clone':
        reset('compo')
        for phrase in memories['impro']:
            models['compo'].learn_phrase(phrase,False); memories['compo'].append(phrase)
        return json.dumps({'notes':[],'phrases':len(memories['compo']),'message':'Impro memory copied into an independent Compo memory.'})
    m=models[ch]; notes=convert(p['notes']) if p.get('notes') else []
    if p.get('learn',False) and notes:
        m.learn_phrase(notes,False); memories[ch].append(notes)
    result={'notes':[],'phrases':len(memories[ch]),'message':''}
    kind=p.get('kind','continuation')
    if kind=='nothing' or action=='learn':
        result['message']='Phrase learned. No response requested.'; return json.dumps(result)
    if not memories[ch]:
        result['message']='First play and learn a phrase.'; return json.dumps(result)
    if not notes: notes=memories[ch][-1]
    if kind=='auto': kind='continuation' if len(notes)<=4 else ('variation' if notes[0].pitch!=notes[-1].pitch else 'answer')
    length=max(1,min(int(p.get('length',len(notes))),32))
    if kind=='echo': generated=notes
    else:
        constraints=ConstraintProblem(length=length)
        def constrain(pos,pitch):
            options={m.get_viewpoint(n) for phrase in memories[ch] for n in phrase if n.pitch==pitch}
            if not options: return False
            constraints.require_one_of(pos,options); return True
        if kind=='variation':
            if length==1 and notes[0].pitch!=notes[-1].pitch:
                result['message']='A one-note variation cannot satisfy two different endpoint pitches.'; return json.dumps(result)
            constrain(0,notes[0].pitch); constrain(length-1,notes[-1].pitch)
        elif kind=='answer': constrain(length-1,notes[0].pitch)
        elif kind=='conclusion':
            if not constrain(length-1,int(p.get('firstPitch',notes[0].pitch))):
                result['message']='No learned note matches the conclusion target.'; return json.dumps(result)
        prefix=notes if kind in ['continuation','answer','conclusion'] else None
        vp=m.sample_sequence(prefix=prefix,length=length,constraints=constraints,raise_on_fail=False)
        if vp is None:
            result['message']='No feasible '+kind+'. Try another length or enrich the memory. No constraints were relaxed.'
            return json.dumps(result)
        generated=m.realize_vp_sequence(vp)
    origin=min((n.start_time for n in generated),default=0)
    out=[{'pitch':n.pitch,'velocity':n.velocity,'start':max(0,(n.start_time-origin)/2),'duration':max(.03,n.duration/2)} for n in generated]
    rhythm=p.get('rhythm','memory')
    if rhythm=='input':
        for i,n in enumerate(out):
            source=notes[i%len(notes)]; cycle=i//len(notes)
            span=max(x.get_end_time() for x in notes)/2
            n['start']=source.start_time/2+cycle*span; n['duration']=source.duration/2
    elif rhythm=='linear':
        for i,n in enumerate(out): n['start']=i*.5; n['duration']=.45
    if p.get('velocity')=='input':
        for i,n in enumerate(out): n['velocity']=notes[i%len(notes)].velocity
    result.update(notes=out,message='Generated '+kind+' from learned memory.',kind=kind)
    return json.dumps(result)
