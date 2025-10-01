import sqlite3
import os
import json
from dotenv import load_dotenv
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import sys

# --- Configuration ---
# Relative paths from the script's location (ai-coding-terminal/tools/)
DB_PATH = '../rust/backend/data/act.db'
ENV_PATH = '../rust/backend/.env'
GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/todo/lists'

# --- ANSI Colors for better logging ---
class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def log_step(message):
    print(f"\n{bcolors.HEADER}===== {message} ====={bcolors.ENDC}")

def log_info(key, value):
    print(f"{bcolors.OKCYAN}{key:<25}{bcolors.ENDC}{value}")

def log_success(message):
    print(f"{bcolors.OKGREEN}✅ SUCCESS: {message}{bcolors.ENDC}")

def log_error(message):
    print(f"{bcolors.FAIL}❌ ERROR: {message}{bcolors.ENDC}", file=sys.stderr)
    
def log_warning(message):
    print(f"{bcolors.WARNING}⚠️  WARNING: {message}{bcolors.ENDC}")

def mask_secret(secret: str) -> str:
    """Masks a secret, showing only the first and last 4 characters."""
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}...{secret[-4:]}"

def decrypt_token(encrypted_base64: str, key_hex: str, user_id: str) -> str:
    """
    Decrypts a token using AES-256-GCM, replicating the Rust backend's logic.
    - Key: 64-char hex string
    - AAD: user_id
    - Encrypted data: base64(nonce + ciphertext + tag)
    """
    log_step("Decrypting Access Token")
    try:
        # 1. Prepare the key
        if len(key_hex) != 64:
            raise ValueError("Encryption key must be a 64-character hex string.")
        key_bytes = bytes.fromhex(key_hex)
        log_info("Encryption Key (Hex):", mask_secret(key_hex))

        # 2. Decode the encrypted data from Base64
        encrypted_data = base64.b64decode(encrypted_base64)
        log_info("Encrypted Token (B64):", f"{mask_secret(encrypted_base64)} ({len(encrypted_base64)} chars)")

        # 3. Separate nonce and ciphertext
        if len(encrypted_data) < 12:
            raise ValueError("Invalid encrypted data: too short to contain a nonce.")
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        log_info("Nonce (Hex):", nonce.hex())
        log_info("Ciphertext (Hex):", f"{ciphertext.hex()[:8]}... ({len(ciphertext)} bytes)")

        # 4. Prepare AAD (Additional Authenticated Data)
        aad = user_id.encode('utf-8')
        log_info("AAD (User ID):", user_id)

        # 5. Decrypt using AES-256-GCM
        aesgcm = AESGCM(key_bytes)
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
        
        decrypted_token = decrypted_bytes.decode('utf-8')
        log_success("Token decrypted successfully.")
        return decrypted_token

    except Exception as e:
        log_error(f"Decryption failed: {e}")
        raise

def list_todo_lists(access_token: str):
    """Makes an API call to the Microsoft Graph API to list To Do lists."""
    log_step("Querying Microsoft Graph API")
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    log_info("API Endpoint:", GRAPH_API_ENDPOINT)
    log_info("Authorization Header:", f"Bearer {mask_secret(access_token)}")

    try:
        response = requests.get(GRAPH_API_ENDPOINT, headers=headers, timeout=15)
        log_info("Response Status Code:", f"{response.status_code} {response.reason}")

        response.raise_for_status()  # Raises an exception for bad status codes (4xx or 5xx)

        log_success("API call successful.")
        return response.json()
    except requests.exceptions.RequestException as e:
        log_error(f"API request failed: {e}")
        if e.response is not None:
            try:
                log_error(f"Response Body: {e.response.text}")
            except Exception:
                pass
        raise

def main():
    """Main debugging script execution."""
    print(f"{bcolors.BOLD}--- Microsoft To Do Integration Debugger ---{bcolors.ENDC}")

    # 1. Check for required files
    if not os.path.exists(DB_PATH) or not os.path.exists(ENV_PATH):
        log_error(f"Could not find '{DB_PATH}' or '{ENV_PATH}'.")
        log_info("Instruction:", "Please run this script from the `ai-coding-terminal/tools/` directory.")
        sys.exit(1)

    # 2. Load environment variables
    load_dotenv(dotenv_path=ENV_PATH)
    encryption_key = os.getenv('MS_ENCRYPTION_KEY')
    if not encryption_key:
        log_error("`MS_ENCRYPTION_KEY` not found in .env file.")
        sys.exit(1)

    conn = None
    try:
        # 3. Connect to the database
        log_step("Connecting to Database")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        log_info("Database Path:", DB_PATH)
        log_success("Connected to database.")

        # 4. Fetch the first user with Microsoft auth data
        log_step("Fetching User and Encrypted Tokens")
        cursor.execute("""
            SELECT u.id, u.username, msa.access_token_encrypted
            FROM users u
            JOIN user_microsoft_auth msa ON u.id = msa.user_id
            LIMIT 1
        """)
        row = cursor.fetchone()
        if not row:
            log_error("No user with Microsoft authentication data found in the database.")
            sys.exit(1)
        
        user_id, username, access_token_blob = row
        # The blob is read as bytes, which needs to be decoded to string for base64
        encrypted_token_b64 = access_token_blob.decode('utf-8')
        log_info("Found User:", f"{username} (ID: {user_id})")
        log_success("Fetched encrypted token from database.")
        
        # 5. Decrypt the token
        access_token = decrypt_token(encrypted_token_b64, encryption_key, user_id)
        log_info("Decrypted Token:", mask_secret(access_token))

        # 6. Call Microsoft Graph API
        api_data = list_todo_lists(access_token)

        # 7. Analyze and report results
        log_step("Analysis of API Response")
        log_info("Raw JSON Response:", json.dumps(api_data, indent=2))
        
        task_lists = api_data.get('value', [])
        
        if not isinstance(task_lists, list):
            log_error("API response format is unexpected. 'value' is not a list.")
            sys.exit(1)
            
        log_info("Number of Task Lists:", str(len(task_lists)))

        if not task_lists:
            log_warning("The API returned an empty list of task lists.")
            print("-" * 40)
            print(f"{bcolors.BOLD}Conclusion:{bcolors.ENDC}")
            print("The user's Microsoft account is authenticated correctly, but the Graph API is not returning any To Do lists.")
            print("This usually happens for accounts that have not explicitly used the Microsoft To Do app/service before.")
            print(f"{bcolors.OKGREEN}The problem is not with the user's credentials but with the state of their To Do account.{bcolors.ENDC}")
            print("The proposed fix in the Rust backend to create a default list if none exists is the correct solution.")
            print("-" * 40)
        else:
            log_success("The API returned one or more task lists!")
            print("-" * 40)
            print(f"{bcolors.BOLD}Conclusion:{bcolors.ENDC}")
            print("The user's credentials are valid and the Graph API is returning task lists correctly.")
            for i, task_list in enumerate(task_lists):
                print(f"  - List {i+1}: \"{task_list.get('displayName', 'N/A')}\" (ID: {task_list.get('id')})")
            print(f"{bcolors.WARNING}The issue is likely within the application's logic for processing or displaying these lists.{bcolors.ENDC}")
            print("Please review the frontend stores (`todo.ts`) and backend services (`microsoft_auth_service.rs`) for how this data is handled after being fetched.")
            print("-" * 40)

    except Exception as e:
        log_error(f"An unexpected error occurred during the script: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()
            log_step("Database connection closed.")

if __name__ == "__main__":
    main()
