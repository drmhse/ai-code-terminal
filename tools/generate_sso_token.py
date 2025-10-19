#!/usr/bin/env python3
"""
Generate a valid SSO JWT token for testing the backend authentication.

This script creates a JWT token signed with RS256 using the SSO's private key.
The token includes all required claims and can be used to test the backend endpoints.
"""

import base64
import hashlib
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
    import jwt
except ImportError:
    print("Error: Required packages not installed.")
    print("Install with: pip install pyjwt cryptography")
    sys.exit(1)


# SSO Configuration from .env
JWT_PRIVATE_KEY_BASE64 = "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ0dlSHhCSHJkRE9wR3cKLzNOcGhkK2JhRTNEaGNac3F3cE83Tm0rZUxsMGNkWERINUc2eXBURW1oS25LLzYrRmM4UE95SnB1R0ZORll5NAoyUUd4VVBiekJyeTZ3ay80TWMwV09mNXlKOFh6djlLRGcyM0pObk1OLys1cExLT0UzTS9BbSs2aVpYd1ZUMGJ0ClR4aU9nNlppajlLS3hZck9ZSitqWEE3aE1xWHFwc1h5b2t4d3pKLzM3eG96QktpRnVycGtad2tGZzQ0cldHSTYKalovN0pxRWszSHM0djdUcGZiWUovWnRzcndhYnduMWdzZDA4enpLVXNQTURGelpuWTJwTGorUG5tNWJTd1ZuTgpWSDRxTjBMNWtYUWxQMVZmQ1VhTTV1YnVxenE0c3FPeVJ0aTFRYTI0dG1qMS9jeXJKRno2OFhtT1RyZm1Cbmc3CmZMa0IzdHM3QWdNQkFBRUNnZ0VBRCtLMlJHMGxWNUd1T2h1R0hna0hndnVkOVlOZFpHTmZzRFk3MGt3VWEwU3kKd2o1OXFwN3ZBZVlmczZtM1g1WlhvK1FucXhkSFFMZDkxeTBsRFl1cE9NbVZkeUg5d2k0dW5ROFVna0RmbWtMbQowc3d1ZStSQ1VGSSttYzhyc1hEeWhyMnZ3Y3M5RHVRUzFzc095c1hwQnpZWURjdkxjTzVVNkQ2M3IvUHZTaS9tCkFTM051VlMycWNYOFd1RGt0Q3hKRFRxQjREa2ZWRnpoUFV2NWJmaThHWVUwZ2Z3TmZMYUpHdmcyUTdSQzl6eC8KejBncVNZTnZaMllWem8zY3Jvckh2S2F1M0RhcVZpRG1sVTBubEtncFJxbXZCNG9IeHRYcVgxNnY0OEs4WGwxRAo5V3lFNUZYanJEUWhPZWNWazJ6NDJDdWp1TjZlVlppeUk5blpBV2JBM1FLQmdRQzV6eVZCMHE0bkNrNm9pWitSCnNkWkkvb3k1ajY3VkJ0T0ZhNUpzS092UGtYMjlQclA1ZlN0dXFNNklDUFNmMWVwTmI5REZrN2gwVENqbmhuRHEKYWpJeDZUMk5GWWJMTEo0L05iS0RnNDI3UHdzTzcrbFAxM0l1eDdvUi94R2RpZFExcUwzdVdVSlB5cFZKM2xXTgpPWkk2U1Z2dU4wY0wzNnFaUkdhREExWGFSd0tCZ1FDNVJKbGF1emx5MndpTUNxVFRlSUV6TGNibHV3eHFROVN1CkFQUDFoWkVxMVdMOERvbitqZUIyTkxwRTNUWG9QRzRncVNxSTFxS05vSTE0ekNVWjlyMTkvcjg2eEkvaGZ1UXYKRkxJZjQ2TnJ0MzdMZnNNTGxGL3dIQWxrc05JYU9TQTFkZ3ZORC80Rm9BNkwzeldYNGdyTFZjQVIvK2c4ZmlIKwpJTWNJelVJOWJRS0JnRGhWQ2VtYjB2cTVFRUhlZjRjdlVGVU8vMkVlbzVXb0hTYTlCMFpOWGJpdlZseXlqdVBiCncvZ25xMzNvb1NsNE5ESEg3WmFKQTRvV3NPd0lnV0ZBVXZsNHloVms2bG5jckJsajBUdzMvUmRBdEx5UmxiMkUKQnZVUnptSzRYd0hSRUlvNEgyVU1vS01LT3hxTEVvcmZZbXJUWk5DaTU2STg3RDdOVXZyelh1cnZBb0dBVk5tZApIcGZHdk5xaDlIbGZlZGFqM1l1bW4wcG1hamk4ckNDVm1xbmNqWENEVUF0Y21lL2lrR0NmdXJCUll4WmlIYVU4CmJNVllWMkxqeUNJL0Q4QVlreDdiK0E5VUVpTnFZRUdyUHIyajk4NW5UTTIyaUpRZ3lEZ2UrVFdlVkJJN3RTQm0KVVRsMHpxQzZhTWNHcFpRSis0dy9WajhNM3IrcDA5aXhMMC9LZVpVQ2dZRUFnTGQyeEJROE1Cam9POG44ci8ycgptTTl3cWpzTXpqa1JzN3l1Vi9tMEZEOXFEemI2aGlMMmpGZHBpeXh6Yzg4NzNmdmVkaGxZSGg0T2svN0JpdDk3CjV3Wjh0TVFaZ3BCUzBZMkZ5dGE3cnZzeXNQclhKRmk5bXZSSnNsWk9DZmtjaXdLYU03S1BXM2c1cktsWk1JV08KSzFGeXBzOXpRS1ZvSkRWdkJlQ3BaV289Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"
JWT_KID = "sso-key-2025-01-01"
JWT_EXPIRATION_HOURS = 24


def decode_private_key(base64_key: str):
    """Decode base64 private key to PEM format."""
    pem_key = base64.b64decode(base64_key)
    return serialization.load_pem_private_key(
        pem_key,
        password=None,
        backend=default_backend()
    )


def hash_token(token: str) -> str:
    """Hash token using SHA256 (same as backend)."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_sso_token(
    user_id: str = "test-user-123",
    org: str = "ai-code-terminal",
    service: str = "terminal",
    plan: str = "pro",
    features: list = None,
    expiration_hours: int = JWT_EXPIRATION_HOURS
) -> tuple[str, str, dict]:
    """
    Generate a valid SSO JWT token.

    Args:
        user_id: Unique user identifier (sub claim)
        org: Organization slug
        service: Service slug
        plan: Subscription plan
        features: List of enabled features
        expiration_hours: Token expiration time in hours

    Returns:
        Tuple of (token, token_hash, claims)
    """
    if features is None:
        features = ["git_integration", "microsoft_integration", "ai_assistant"]

    # Decode private key
    private_key = decode_private_key(JWT_PRIVATE_KEY_BASE64)

    # Create claims
    now = int(time.time())
    exp = now + (expiration_hours * 3600)

    claims = {
        "sub": user_id,
        "org": org,
        "service": service,
        "plan": plan,
        "features": features,
        "exp": exp,
        "iat": now
    }

    # Create JWT with RS256
    token = jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": JWT_KID}
    )

    # Hash the token (for database storage)
    token_hash = hash_token(token)

    return token, token_hash, claims


def main():
    """Generate and display a test SSO token."""
    print("=" * 80)
    print("SSO JWT Token Generator")
    print("=" * 80)
    print()

    # Generate token
    token, token_hash, claims = generate_sso_token()

    # Display token info
    print("Generated SSO Token:")
    print("-" * 80)
    print(f"Token: {token}")
    print()
    print(f"Token Hash (SHA256): {token_hash}")
    print()
    print("Claims:")
    print(json.dumps(claims, indent=2))
    print()

    # Calculate expiration
    exp_time = datetime.fromtimestamp(claims["exp"])
    print(f"Expires at: {exp_time.strftime('%Y-%m-%d %H:%M:%S')} ({JWT_EXPIRATION_HOURS} hours from now)")
    print()

    # Instructions
    print("=" * 80)
    print("Next Steps:")
    print("=" * 80)
    print()
    print("1. Create a session in the backend database:")
    print(f"""
   sqlite3 rust/backend/data/act.db <<EOF
   INSERT INTO sso_sessions (id, user_id, sso_token_hash, provider, expires_at, created_at)
   VALUES (
       'test-session-{int(time.time())}',
       'temp-user-id',
       '{token_hash}',
       'github',
       datetime('{exp_time.strftime('%Y-%m-%d %H:%M:%S')}'),
       datetime('now')
   );
EOF
    """)
    print()
    print("2. Test the token with curl:")
    print(f"""
   curl -X GET http://localhost:3001/api/health \\
        -H "Authorization: Bearer {token}" \\
        -H "Content-Type: application/json"
    """)
    print()
    print("3. Save token to file for later use:")
    print(f"""
   echo "{token}" > /tmp/sso_test_token.txt
    """)
    print()
    print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
