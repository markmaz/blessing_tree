from passlib.hash import bcrypt


class PasswordService:
    def hash_password(self, password: str) -> str:
        return bcrypt.hash(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        return bcrypt.verify(password, password_hash)
