import pandas as pd
import json
import math

df = pd.read_excel('aisc-shapes-database-v160-2.xlsx', sheet_name='Database v16.0')

# Filter for W shapes
df_w = df[df["Type"] == "W"]

shapes = []
for _, row in df_w.iterrows():
    designation = str(row.get("AISC_Manual_Label", ""))
    if not designation or pd.isna(designation):
        continue
        
    def get_val(col):
        if col in df.columns:
            val = row[col]
            if pd.isna(val) or val == '-' or val == '':
                return None
            try:
                return float(val)
            except:
                return None
        return None

    # Using the metric columns (.1) as identified in the headers
    shape = {
        "designation": designation,
        "type": "W",
        "weight": get_val("W.1"),
        "area": get_val("A.1"),
        "d": get_val("d.1"),
        "bf": get_val("bf.1"),
        "tw": get_val("tw.1"),
        "tf": get_val("tf.1"),
        "b": get_val("b.1") or get_val("B.1"), 
        "H": get_val("Ht.1") or get_val("h.1"),
        "OD": get_val("OD.1"),
        "t": get_val("tdes.1") or get_val("t.1"),
        "kdes": get_val("kdes.1"),
        "Ix": get_val("Ix.1"),
        "Iy": get_val("Iy.1"),
        "Sx": get_val("Sx.1"),
        "Sy": get_val("Sy.1"),
        "Zx": get_val("Zx.1"),
        "Zy": get_val("Zy.1"),
        "rx": get_val("rx.1"),
        "ry": get_val("ry.1"),
        "J": get_val("J.1"),
        "Cw": get_val("Cw.1"),
        "rts": get_val("rts.1"),
        "ho": get_val("ho.1"),
        "bf_2tf": get_val("bf/2tf.1"),
        "h_tw": get_val("h/tw.1"),
        "b_t": get_val("b/t.1"),
        "D_t": get_val("D/t.1"),
        "rz": get_val("rz.1"),
        "x": get_val("x.1"),
        "y": get_val("y.1"),
        "xp": get_val("xp.1"),
        "yp": get_val("yp.1"),
        "T_dim": get_val("T.1"),
        "b_tdes": get_val("b/tdes.1"),
        "h_tdes": get_val("h/tdes.1"),
        "source": "AISC 16.0 Shape Database"
    }
    shapes.append(shape)

# Also get C, L, HSS shapes if we want, but let's just do all W, C, L, HSS shapes
df_other = df[df["Type"].isin(["C", "MC", "L", "HSS"])]
for _, row in df_other.iterrows():
    designation = str(row.get("AISC_Manual_Label", ""))
    if not designation or pd.isna(designation):
        continue
    def get_val(col):
        if col in df.columns:
            val = row[col]
            if pd.isna(val) or val == '-' or val == '':
                return None
            try:
                return float(val)
            except:
                return None
        return None
    
    shape = {
        "designation": designation,
        "type": row["Type"],
        "weight": get_val("W.1"),
        "area": get_val("A.1"),
        "d": get_val("d.1"),
        "bf": get_val("bf.1"),
        "tw": get_val("tw.1"),
        "tf": get_val("tf.1"),
        "b": get_val("b.1") or get_val("B.1"), 
        "H": get_val("Ht.1") or get_val("h.1"),
        "OD": get_val("OD.1"),
        "t": get_val("tdes.1") or get_val("t.1"),
        "kdes": get_val("kdes.1"),
        "Ix": get_val("Ix.1"),
        "Iy": get_val("Iy.1"),
        "Sx": get_val("Sx.1"),
        "Sy": get_val("Sy.1"),
        "Zx": get_val("Zx.1"),
        "Zy": get_val("Zy.1"),
        "rx": get_val("rx.1"),
        "ry": get_val("ry.1"),
        "J": get_val("J.1"),
        "Cw": get_val("Cw.1"),
        "rts": get_val("rts.1"),
        "ho": get_val("ho.1"),
        "bf_2tf": get_val("bf/2tf.1"),
        "h_tw": get_val("h/tw.1"),
        "b_t": get_val("b/t.1"),
        "D_t": get_val("D/t.1"),
        "rz": get_val("rz.1"),
        "x": get_val("x.1"),
        "y": get_val("y.1"),
        "xp": get_val("xp.1"),
        "yp": get_val("yp.1"),
        "T_dim": get_val("T.1"),
        "b_tdes": get_val("b/tdes.1"),
        "h_tdes": get_val("h/tdes.1"),
        "source": "AISC 16.0 Shape Database"
    }
    shapes.append(shape)


with open("js/sectionDatabase.js", "w", encoding='utf-8') as f:
    f.write("const steelDatabase = ")
    json.dump(shapes, f, indent=2)
    f.write(";\n\n")
    f.write("export default steelDatabase;\n")
    
print(f"Generated js/sectionDatabase.js with {len(shapes)} sections.")
