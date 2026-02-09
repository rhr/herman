#!/usr/bin/env python3
"""
Interactive script to create user registration invitations
Reads admin credentials from .env and creates invitations via the API
"""

import os
import sys
import requests
from dotenv import load_dotenv
from pathlib import Path

# Color codes for terminal output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_success(message):
    print(f"{GREEN}✓{RESET} {message}")

def print_error(message):
    print(f"{RED}✗{RESET} {message}")

def print_info(message):
    print(f"{BLUE}ℹ{RESET} {message}")

def print_header(message):
    print(f"\n{BOLD}{BLUE}{message}{RESET}")

def load_environment():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent / '.env'
    if not env_path.exists():
        print_error(f".env file not found at {env_path}")
        print_info("Create a .env file with HERMAN_USER and HERMAN_PASSWORD")
        sys.exit(1)

    load_dotenv(env_path)

    username = os.getenv('HERMAN_USER')
    password = os.getenv('HERMAN_PASSWORD')
    api_url = os.getenv('API_BASE_URL', 'http://localhost:8000')

    if not username or not password:
        print_error("HERMAN_USER and HERMAN_PASSWORD must be set in .env")
        print_info("Add these lines to your .env file:")
        print("  HERMAN_USER=your@email.com")
        print("  HERMAN_PASSWORD=yourpassword")
        sys.exit(1)

    return username, password, api_url

def login(username, password, api_url):
    """Login to the API and get JWT token"""
    print_header("🔐 Authenticating...")
    print_info(f"Logging in as: {username}")

    try:
        response = requests.post(
            f"{api_url}/api/auth/login",
            json={
                "email": username,
                "password": password
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            user = data.get('user', {})
            print(user)

            if user.get('is_admin'):
                print_success(f"Logged in as admin: {user.get('name', username)}")
                return token
            else:
                print_error("User is not an admin. Only admins can create invitations.")
                print_info("To make a user admin, run:")
                print(f"  UPDATE users SET is_admin = TRUE WHERE email = '{username}';")
                sys.exit(1)

        elif response.status_code == 401:
            print_error("Invalid credentials")
            sys.exit(1)
        else:
            print_error(f"Login failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            sys.exit(1)

    except requests.exceptions.ConnectionError:
        print_error(f"Could not connect to API at {api_url}")
        print_info("Make sure the backend server is running")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print_error("Request timed out")
        sys.exit(1)
    except Exception as e:
        print_error(f"Login error: {e}")
        sys.exit(1)

def get_user_input():
    """Prompt user for invitation details"""
    print_header("📝 Invitation Details")

    # Email
    while True:
        email = input(f"{YELLOW}Email address:{RESET} ").strip()
        if email and '@' in email:
            break
        print_error("Please enter a valid email address")

    # Expiration
    while True:
        expiry_input = input(f"{YELLOW}Expires in days (default: 7):{RESET} ").strip()
        if not expiry_input:
            expiry_days = 7
            break
        try:
            expiry_days = int(expiry_input)
            if expiry_days > 0:
                break
            print_error("Please enter a positive number")
        except ValueError:
            print_error("Please enter a valid number")

    # Notes
    notes = input(f"{YELLOW}Notes (optional):{RESET} ").strip()

    return email, expiry_days, notes or None

def create_invitation(token, email, expiry_days, notes, api_url):
    """Create invitation via API"""
    print_header("🎫 Creating Invitation...")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "email": email,
        "expires_in_days": expiry_days
    }

    if notes:
        payload["notes"] = notes

    try:
        response = requests.post(
            f"{api_url}/api/invitations",
            headers=headers,
            json=payload,
            timeout=10
        )

        if response.status_code == 201:
            data = response.json()
            print_success("Invitation created successfully!")
            print()
            print(f"{BOLD}Invitation Details:{RESET}")
            print(f"  ID:         {data['id']}")
            print(f"  Email:      {data['email']}")
            print(f"  Expires:    {data.get('expires_at', 'Never')}")
            print(f"  Created:    {data['created_at']}")
            if data.get('notes'):
                print(f"  Notes:      {data['notes']}")
            print()
            print(f"{BOLD}{GREEN}📧 Send this link to the user:{RESET}")
            print(f"{BOLD}{data['invitation_url']}{RESET}")
            print()
            return data

        elif response.status_code == 400:
            error_detail = response.json().get('detail', 'Unknown error')
            print_error(f"Failed to create invitation: {error_detail}")
            return None

        elif response.status_code == 403:
            print_error("Access denied. Admin privileges required.")
            return None

        else:
            print_error(f"Failed to create invitation: {response.status_code}")
            print_info(f"Response: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {e}")
        return None

def main():
    print(f"{BOLD}{BLUE}")
    print("=" * 60)
    print("  🎫 Herbarium Pro - Invitation Generator")
    print("=" * 60)
    print(RESET)

    # Load credentials
    username, password, api_url = load_environment()

    # Login and get token
    token = login(username, password, api_url)

    # Get invitation details from user
    email, expiry_days, notes = get_user_input()

    # Confirm
    print()
    print(f"{BOLD}Review:{RESET}")
    print(f"  Email:      {email}")
    print(f"  Expires in: {expiry_days} days")
    print(f"  Notes:      {notes or '(none)'}")
    print()

    confirm = input(f"{YELLOW}Create this invitation? (y/N):{RESET} ").strip().lower()
    if confirm != 'y':
        print_info("Cancelled")
        sys.exit(0)

    # Create invitation
    result = create_invitation(token, email, expiry_days, notes, api_url)

    if result:
        print_success("Done!")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_info("Cancelled by user")
        sys.exit(0)
