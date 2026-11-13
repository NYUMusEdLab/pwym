import json
from ctor.continuator import Continuator2
from midi_stuff.mini_muse import Note
model = Continuator2(kmax=4, seed=7, cache_bytes=8*1024*1024)

def exchange(payload):
    global model
    p=json.loads(payload)
    if p.get('action')=='clear':
        model=Continuator2(kmax=int(p.get('order',4)), seed=7,cache_bytes=8*1024*1024)
        return json.dumps({'notes':[], 'phrases':0,'message':'Memory cleared. Start a new musical conversation.'})
    raw=p.get('notes',[])
    if not 1 <= len(raw) <= 256: raise ValueError('Play between 1 and 256 notes.')
    notes=[]
    for r in raw:
        pitch=int(r['pitch']); velocity=int(r.get('velocity',90)); start=float(r['start']); duration=float(r['duration'])
        if not (0<=pitch<=127 and 1<=velocity<=127 and 0<=start<300 and .01<=duration<=30): raise ValueError('Invalid note range')
        notes.append(Note(pitch,velocity,duration*2,start_time=start*2))
    notes.sort(key=lambda n:n.start_time)
    base=notes[0].start_time
    for i,n in enumerate(notes):
        n.start_time-=base
    for i,n in enumerate(notes):
        n.next_start_delta=notes[i+1].start_time-n.get_end_time() if i+1<len(notes) else 0
        n.overlaps_left_flag=any(prev.get_end_time()>n.start_time for prev in notes[:i])
    model.learn_phrase(notes,False)
    length=max(1,min(int(p.get('length',len(notes))),32))
    vp=model.continue_sequence(notes,length=length,raise_on_fail=False)
    restarted = vp is None
    if restarted:
        vp=model.sample_sequence(length=length,raise_on_fail=False)
    if vp is None:
        return json.dumps({'notes':[],'phrases':len(model.get_phrase_titles()),'message':'No feasible continuation. Play another phrase; no constraints were silently relaxed.'})
    generated=model.realize_vp_sequence(vp)
    origin=min((n.start_time for n in generated),default=0)
    return json.dumps({'notes':[{'pitch':n.pitch,'velocity':n.velocity,'start':max(0,(n.start_time-origin)/2),'duration':max(.03,n.duration/2)} for n in generated], 'phrases':len(model.get_phrase_titles()), 'message':('Responding with a new phrase from learned memory (no continuation from the final note).' if restarted else 'Responding from your phrase…')})
