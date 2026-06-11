import base64
import hashlib
import hmac
import os
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app.database import execute, execute_many, fetch_one, insert_returning, is_database_configured
from app.models.schemas import AgeGroup

router = APIRouter()

PBKDF2_ITERATIONS = 210_000


class AuthRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=4)
    age_group: AgeGroup = AgeGroup.OTHER


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class AuthResponse(BaseModel):
    user_id: str
    email: str
    age_group: str
    message: str


@lru_cache(maxsize=1)
def ensure_auth_schema() -> None:
    try:
        execute_many([
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email text",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (lower(email)) WHERE email IS NOT NULL",
        ])
    except SQLAlchemyError:
        # The app DB user may not own the table in remote environments. The dev
        # schema already includes the auth columns, so runtime DDL is optional.
        return


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="올바른 이메일을 입력해 주세요.")
    return normalized


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, encoded_salt, encoded_digest = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(encoded_salt.encode("ascii"))
        expected = base64.b64decode(encoded_digest.encode("ascii"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


@router.post("/signup", response_model=AuthResponse)
async def signup(request: AuthRequest):
    if not is_database_configured():
        raise HTTPException(status_code=503, detail="DB가 설정되어 있지 않습니다.")

    ensure_auth_schema()
    email = normalize_email(request.email)
    existing = fetch_one(
        """
        SELECT id, email, password_hash, age_group, status
        FROM users
        WHERE lower(email) = :email
          AND status != 'withdrawn'
        """,
        {"email": email},
    )
    if existing:
        if existing.get("password_hash"):
            raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다. 로그인해 주세요.")
        if existing.get("status") == "locked":
            raise HTTPException(status_code=403, detail="잠긴 계정입니다.")
        execute(
            """
            UPDATE users
            SET password_hash = :password_hash,
                age_group = COALESCE(age_group, :age_group),
                status = 'active',
                password_changed_at = now(),
                updated_at = now()
            WHERE id = CAST(:user_id AS uuid)
            """,
            {
                "user_id": str(existing["id"]),
                "password_hash": hash_password(request.password),
                "age_group": request.age_group.value,
            },
        )
        return AuthResponse(
            user_id=str(existing["id"]),
            email=existing["email"],
            age_group=existing["age_group"] or request.age_group.value,
            message="기존 계정의 비밀번호가 설정되었습니다.",
        )

    row = insert_returning(
        """
        INSERT INTO users (email, password_hash, age_group, role, status, password_changed_at, updated_at)
        VALUES (:email, :password_hash, :age_group, 'user', 'active', now(), now())
        RETURNING id, email, age_group
        """,
        {
            "email": email,
            "password_hash": hash_password(request.password),
            "age_group": request.age_group.value,
        },
    )
    return AuthResponse(
        user_id=str(row["id"]),
        email=row["email"],
        age_group=row["age_group"] or AgeGroup.OTHER.value,
        message="테스트 계정이 생성되었습니다.",
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    if not is_database_configured():
        raise HTTPException(status_code=503, detail="DB가 설정되어 있지 않습니다.")

    ensure_auth_schema()
    email = normalize_email(request.email)
    row = fetch_one(
        """
        SELECT id, email, password_hash, age_group, status
        FROM users
        WHERE lower(email) = :email
        """,
        {"email": email},
    )
    if not row or not row.get("password_hash") or not verify_password(request.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")
    if row.get("status") == "withdrawn":
        raise HTTPException(status_code=403, detail="탈퇴 처리된 계정입니다.")
    if row.get("status") == "locked":
        raise HTTPException(status_code=403, detail="잠긴 계정입니다.")

    execute(
        """
        UPDATE users
        SET last_login_at = now(), updated_at = now()
        WHERE id = CAST(:user_id AS uuid)
        """,
        {"user_id": str(row["id"])},
    )
    return AuthResponse(
        user_id=str(row["id"]),
        email=row["email"],
        age_group=row["age_group"] or AgeGroup.OTHER.value,
        message="로그인되었습니다.",
    )
