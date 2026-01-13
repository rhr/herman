import os, pandas as pd
import herman
from dotenv import load_dotenv
load_dotenv()

df = pd.read_csv('backend/imports/labnotes_specimen_20260109.csv', index_col=0)
df2 = pd.read_csv('/tmp/herman_specimens_20260109.csv', index_col=0)
df2 = df2.loc[df2.code.notna()]
c2i = pd.Series(index=df2.code, data=df2.index)

user = os.getenv('HERMAN_USER')
passwd = os.getenv('HERMAN_PASSWORD')
api = herman.APIClient()
api.login(user, passwd)

cols = ['comments', 'comments_PK', 'taxonomic_implication_PK', 'proposal_PK', 'suspect', 'isvirtual']

for j, r in df.iterrows():
    try:
        i = c2i[r.code]
    except KeyError:
        # print(r.code)
        continue
    d = r[cols].dropna()
    x = d.get('comments')
    if x:
        api.create_annotation(i, x.strip())
    x = d.get('comments_PK')
    if x:
        api.create_annotation(i, f'comments_PK: {x}'.strip())
    x = d.get('taxonomic_implication_PK')
    if x:
        api.create_annotation(i, f'taxonomic_implication_PK: {x}'.strip())
    if d.get('suspect') == 'T':
        api.create_annotation(i, 'suspect')
    if d.get('isvirtual') == 'T':
        api.create_annotation(i, 'virtual')

    
    
