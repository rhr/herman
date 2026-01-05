from labnotes import db
import pandas as pd
from io import StringIO

df = pd.read_csv('imports/labnotes_specimen.csv')

df.index += 1

t = db.specimen_image
q = ((t.specimen == db.specimen.id)&
     (t.image == db.image.id))

rows = db(q).select(
    db.specimen.id, db.image.filename, db.image.image,
    db.image.caption, db.image.comments)

b = StringIO()
rows.export_to_csv_file(b, null='')
b.seek(0)
df2 = pd.read_csv(b, index_col=0).fillna('')

o2n = pd.read_csv('imports/labnotes_id_mapping.csv', index_col=0)['new_id']

v = []
for oldid, r in df2.iterrows():
    newid = o2n[oldid]
    imgpath = r['image.image']
    filename = r['image.filename']
    caption = r['image.caption']
    comments = r['image.comments']
    
    d = dict(
        specimen_id=newid,
        imgpath=f'/home/rree/labnotes-images/{imgpath}',
        filename=filename,
        caption=' '.join([caption, comments]).strip())
    v.append(d)
    
df3 = pd.DataFrame.from_records(v)

df3.to_csv('imports/labnotes_images.csv', index=False)
