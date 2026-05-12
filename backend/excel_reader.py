import pandas as pd


def read_contacts(file_path):
    # Determine file type by extension
    is_csv = str(file_path).lower().endswith('.csv')
    
    try:
        if is_csv:
            df = pd.read_csv(file_path)
        else:
            # For Excel files, use openpyxl engine
            df = pd.read_excel(file_path, engine='openpyxl')
    except Exception as e:
        # Fallback for old .xls if xlrd is available, otherwise raise
        if not is_csv and str(file_path).lower().endswith('.xls'):
            try:
                df = pd.read_excel(file_path, engine='xlrd')
            except ImportError:
                raise Exception("Cannot read .xls file. Please save as .xlsx or .csv")
        else:
            raise Exception(f"Failed to read file: {e}")

    # REMOVE EXTRA SPACES + LOWERCASE
    df.columns = df.columns.str.strip().str.lower()

    print("Detected Columns:", df.columns)

    # POSSIBLE NAME COLUMNS
    name_columns = [
        "name",
        "full name",
        "fullname",
        "user name",
        "username"
    ]

    # POSSIBLE NUMBER COLUMNS
    number_columns = [
        "number",
        "phone",
        "contact",
        "mobile",
        "phone number",
        "contact number",
        "mobile number"
    ]

    # FIND NAME COLUMN
    found_name_column = None

    for col in name_columns:

        if col in df.columns:

            found_name_column = col

            break

    # FIND NUMBER COLUMN
    found_number_column = None

    for col in number_columns:

        if col in df.columns:

            found_number_column = col

            break

    # IF NAME COLUMN NOT FOUND
    if found_name_column is None:

        raise Exception(
            f"Name column not found. Found columns: {list(df.columns)}"
        )

    # IF NUMBER COLUMN NOT FOUND
    if found_number_column is None:

        raise Exception(
            f"Contact column not found. Found columns: {list(df.columns)}"
        )

    contacts = []

    # LOOP THROUGH ROWS
    for _, row in df.iterrows():
        try:
            raw_name = row[found_name_column]
            raw_number = row[found_number_column]

            # Skip if NaN
            if pd.isna(raw_name) or pd.isna(raw_number):
                continue

            name = str(raw_name).strip()
            number = str(raw_number).strip()

            # Final check to avoid "nan" string from str(NaN) and empty strings
            if not name or name.lower() == "nan" or not number or number.lower() == "nan":
                continue

            # CLEAN NUMBER
            # Remove .0 (common in Excel phone numbers)
            if number.endswith(".0"):
                number = number[:-2]
            
            # Remove all non-numeric characters (except maybe + if needed, but here we strip spaces)
            number = "".join(filter(str.isdigit, number))

            if name and number:
                contacts.append({
                    "name": name,
                    "number": number
                })

        except Exception as e:
            print("Row Error:", e)

    print("Total Contacts:", len(contacts))

    return contacts