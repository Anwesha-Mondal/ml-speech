"""Command line account management.

Create the first administrator (prompts for the password; it is never echoed):

    python -m backend.auth.cli create-admin --email you@example.com --name "Your Name"

Promote an existing account, or unlock one:

    python -m backend.auth.cli promote --email teammate@example.com
    python -m backend.auth.cli unlock --email teammate@example.com
"""

from __future__ import annotations

import argparse
import getpass
import sys

from pymongo.errors import DuplicateKeyError

from .config import get_settings
from .db import USERS, User, init_db
from .passwords import check_policy, hash_password
from .router import EMAIL_RE, normalize_email
from .sessions import audit, get_user_by_email


def _create_admin(email: str, name: str) -> int:
    cfg = get_settings()
    email = normalize_email(email)
    if not EMAIL_RE.match(email):
        print("Enter a valid email address.", file=sys.stderr)
        return 2
    db = init_db()
    if get_user_by_email(db, email):
        print(f"{email} already exists. Use `promote` to make it an admin.", file=sys.stderr)
        return 1
    while True:
        pw = getpass.getpass("Password: ")
        res = check_policy(pw, cfg, email, name)
        if not res.ok:
            print("\n".join(res.problems), file=sys.stderr)
            continue
        if getpass.getpass("Repeat password: ") != pw:
            print("The passwords don't match.", file=sys.stderr)
            continue
        break
    user = User(email=email, display_name=name, password_hash=hash_password(pw, cfg), role="admin")
    try:
        db[USERS].insert_one(user.to_doc())
    except DuplicateKeyError:
        print(f"{email} already exists. Use `promote` to make it an admin.", file=sys.stderr)
        return 1
    audit(db, "admin_created_cli", user=user)
    print(f"Created administrator {email}.")
    return 0


def _update(email: str, *, promote: bool = False, unlock: bool = False) -> int:
    email = normalize_email(email)
    db = init_db()
    user = get_user_by_email(db, email)
    if user is None:
        print(f"No account for {email}.", file=sys.stderr)
        return 1
    if promote:
        db[USERS].update_one({"_id": user.id}, {"$set": {"role": "admin"}})
        audit(db, "admin_promoted_cli", user=user)
    if unlock:
        db[USERS].update_one({"_id": user.id}, {"$set": {"locked_until": None, "failed_attempts": 0, "is_active": True}})
        audit(db, "unlocked_cli", user=user)
    print(f"Updated {email}.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m backend.auth.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create-admin", help="Create an administrator account")
    c.add_argument("--email", required=True)
    c.add_argument("--name", required=True)
    for name in ("promote", "unlock"):
        s = sub.add_parser(name)
        s.add_argument("--email", required=True)
    args = parser.parse_args(argv)

    if args.cmd == "create-admin":
        return _create_admin(args.email, args.name)
    return _update(args.email, promote=args.cmd == "promote", unlock=args.cmd == "unlock")


if __name__ == "__main__":
    sys.exit(main())
