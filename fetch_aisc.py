import pandas as pd
import json
import os
import requests

url = "https://www.aisc.org/globalassets/aisc/manual/v16.0_shapes_database/aisc-shapes-database-v16.0.xlsx"
# If the exact URL above is wrong, we might need a fallback.
# AISC 15.0 fallback
fallback_url = "https://www.aisc.org/globalassets/aisc/manual/v15.0-shapes-database/aisc-shapes-database-v15.0.xlsx"

def fetch_and_parse():
    print("Attempting to download v16.0 database...")
    try:
        r = requests.get(url)
        if r.status_code == 200:
            with open("aisc.xlsx", "wb") as f:
                f.write(r.content)
            print("Downloaded v16.0 successfully.")
        else:
            print(f"Failed to download v16.0 (status {r.status_code}). Trying v15.0...")
            r = requests.get(fallback_url)
            if r.status_code == 200:
                with open("aisc.xlsx", "wb") as f:
                    f.write(r.content)
                print("Downloaded v15.0 successfully.")
            else:
                print(f"Failed to download fallback (status {r.status_code}). Please provide the file manually.")
                return
    except Exception as e:
        print("Error downloading:", e)
        return

    print("Parsing Excel file...")
    # AISC database typically has the data on the first sheet or a sheet named "Database vX.X"
    # The header row is usually row 2 or 3 (0-indexed). Let's try reading and finding the header.
    df = pd.read_excel("aisc.xlsx", sheet_name=0)
    
    # AISC databases usually have a few rows of meta-information before the actual column headers
    # "AISC_Manual_Label" or "EDI_Std_Nomenclature" is usually a column name.
    header_idx = None
    for idx, row in df.iterrows():
        if "AISC_Manual_Label" in row.values or "Type" in row.values or "W" in row.values:
            # Maybe row contains 'AISC_Manual_Label'
            if any(isinstance(val, str) and 'AISC_Manual_Label' in val for val in row.values):
                header_idx = idx
                break
    
    if header_idx is not None:
        df = pd.read_excel("aisc.xlsx", sheet_name=0, header=header_idx)
    else:
        # fallback, try header=0
        df = pd.read_excel("aisc.xlsx", sheet_name=0, header=1) # usually row 2

    print("Columns found:", df.columns.tolist()[:10])
    
    # Filter for W shapes
    if "Type" in df.columns:
        df_w = df[df["Type"] == "W"]
    else:
        # Try to infer
        df_w = df[df.iloc[:, 0].astype(str).str.startswith("W")]

    shapes = []
    for _, row in df_w.iterrows():
        # Map columns. Note that AISC databases have specific column names:
        # A, d, tw, bf, tf, Ix, Iy, Zx, Zy, etc. (often with units in the row below, but pandas header might capture the name)
        
        def get_val(col_names):
            for c in col_names:
                if c in df.columns:
                    val = row[c]
                    if pd.isna(val) or val == '-':
                        return None
                    try:
                        return float(val)
                    except:
                        return None
            return None

        designation = row["AISC_Manual_Label"] if "AISC_Manual_Label" in df.columns else str(row.iloc[0])
        
        # NOTE: The database is in imperial units typically.
        # We'll extract imperial and if needed, the prompt asks for the data structure:
        # type, weight, area, d, bf, tw, tf, kdes, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, J, Cw, rts, ho
        
        shape = {
            "designation": designation,
            "type": "W",
            "weight": get_val(["W", "Weight"]),
            "area": get_val(["A"]),
            "d": get_val(["d"]),
            "bf": get_val(["bf"]),
            "tw": get_val(["tw"]),
            "tf": get_val(["tf"]),
            "kdes": get_val(["kdes", "kdes "]),
            "Ix": get_val(["Ix"]),
            "Iy": get_val(["Iy"]),
            "Sx": get_val(["Sx"]),
            "Sy": get_val(["Sy"]),
            "Zx": get_val(["Zx"]),
            "Zy": get_val(["Zy"]),
            "rx": get_val(["rx"]),
            "ry": get_val(["ry"]),
            "J": get_val(["J"]),
            "Cw": get_val(["Cw"]),
            "rts": get_val(["rts"]),
            "ho": get_val(["ho"]),
            "source": "AISC 16th Edition Database"
        }
        shapes.append(shape)

    with open("steelData.json", "w") as f:
        json.dump(shapes, f, indent=4)
        
    print(f"Extracted {len(shapes)} W-shapes to steelData.json")

if __name__ == "__main__":
    fetch_and_parse()
