from labnotes import db
import pandas as pd
from io import StringIO

images = pd.read_csv(
    StringIO(db(db.image.id>0).select().as_csv()),
    index_col=0)

specimens = pd.read_csv(
    StringIO(db(db.specimen.id>0).select().as_csv()),
    index_col=0)

t = db.specimen_image
q = (t.specimen==db.specimen.id)&(t.image==db.image.id)
specimg = pd.read_csv(
    StringIO(db(q).select(db.specimen.id, db.image.ALL).as_csv()))
