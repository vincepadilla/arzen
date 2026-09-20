import pandas as pd
import json

df = pd.read_excel('aisc-shapes-database-v160-2.xlsx', sheet_name='Database v16.0')

# We can find out where the metric columns start. Usually there's "AISC_Manual_Label_Metric" or similar.
# Or we can just output the columns to a json file to inspect.
cols = df.columns.tolist()
with open('headers.json', 'w', encoding='utf-8') as f:
    json.dump(cols, f)

print("Headers written to headers.json")
