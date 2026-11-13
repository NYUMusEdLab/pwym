#!/usr/bin/env python3
"""Build a PRIVATE local index from an independently obtained Anthology province ZIP.
No network requests; no upload; source rights are not changed. Python3.9+.
Usage: python3 prepare-anthology.py --archive province.zip --metadata volume.jsonl [--metadata volume2.jsonl] --output local-index.json
Download source ZIP and matching curated JSONL from the upstream release/repository.
"""
import argparse,json,re,zipfile,xml.etree.ElementTree as ET,hashlib,pathlib
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',required=True);p.add_argument('--metadata',action='append',required=True);p.add_argument('--output',required=True);a=p.parse_args()
rows=[json.loads(line) for name in a.metadata for line in pathlib.Path(name).read_text().splitlines() if line.strip()];out=[];excluded=[]
if len(rows)>2000:raise SystemExit('Import one province at a time (maximum2000 records).')
with zipfile.ZipFile(a.archive) as z:
 for r in rows:
  try:
   path=r['assets']['musicxml'];root=ET.fromstring(z.read(path));part=root.find('part');pitch=[];durations=[];onsets=[];measures=[];lyrics=[];clock=0;div=1
   for measure in part.findall('measure'):
    d=measure.findtext('attributes/divisions');div=float(d) if d else div
    for n in measure.findall('note'):
     if n.find('chord') is not None or n.find('grace') is not None:continue
     duration=float(n.findtext('duration') or 0)/div
     if duration<=0:continue
     onset=clock;clock+=duration;v=n.find('pitch')
     if v is None:continue
     midi=12*(int(v.findtext('octave'))+1)+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[v.findtext('step')]+float(v.findtext('alter') or 0)
     if n.find("tie[@type='stop']") is not None and pitch and midi==pitch[-1]:durations[-1]+=duration;continue
     pitch.append(midi);durations.append(duration);onsets.append(onset);measures.append(measure.get('number','?'));lyrics.append(' / '.join(''.join(t.text or '' for t in l.findall('text')) for l in n.findall('lyric') if l.find('text') is not None))
   if len(pitch)<4:raise ValueError('fewer than4 pitched events')
   fields=r.get('fields',{});get=lambda k:fields.get(k,{}).get('value');raw=get('metronome');met=re.fullmatch(r'(quarter|eighth|half)(\.*)=(\d+(?:\.\d+)?)',raw or '');tempos=[]
   if met:
    unit,dots,rate=met.groups();bpm=float(rate)*{'quarter':1,'eighth':.5,'half':2}[unit]*sum(.5**i for i in range(len(dots)+1));tempos=[{'onset':0,'bpm':bpm,'source':'unreviewed metadata candidate','mark':raw,'verified':False}]
   volume=r['volume_id'];out.append({'id':r['id'],'title':r['title'],'dataset':'Anthology · '+volume+' · '+r.get('dataset_version','unknown'),'notation':'jianpu','pitches':pitch,'durations':durations,'onsets':onsets,'measures':measures,'lyrics':lyrics,'tempos':tempos,'tempoMetadata':{'mark':raw,'text':get('tempo_text'),'source':fields.get('metronome',{}).get('source'),'reviewStatus':fields.get('metronome',{}).get('review_status')},'context':'Book volume: '+volume+' · locality candidate: '+str(get('locality') or 'not supplied')+' · source category: '+str(get('category') or 'not supplied')+' · meter candidate: '+str(get('meter') or 'not supplied'),'pitchReference':'1=C display; source candidate '+str(get('tonic') or 'not supplied'),'provenance':path+' · automatically recognized first part; catalogue scope is not verified origin/ethnicity; unreviewed fields remain candidates','rights':'Private local import only; public redistribution permission not verified','sourceUrl':'https://github.com/m-july/Anthology-of-Chinese-Folk-Songs','collectionProvince':r.get('collection_province'),'metadataFields':fields})
  except Exception as e:excluded.append({'id':r.get('id'),'reason':str(e)})
result={'records':out,'excluded':excluded,'archiveSha256':hashlib.sha256(pathlib.Path(a.archive).read_bytes()).hexdigest(),'limitations':['Not a facsimile or performance; first part only; chord tones and grace notes omitted; score errors remain','Rhythm assumes sequential first-part events; no repeat unfolding','ShaanxiII has known missing lyric characters','Computed archive hash is not upstream verification: compare it with upstream SHA256SUMS']}
pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False));print('Indexed',len(out),'excluded',len(excluded),'bytes',pathlib.Path(a.output).stat().st_size);print('Load this JSON using Sources/help → Local index file. Do not upload the index to public hosting without permission.')
