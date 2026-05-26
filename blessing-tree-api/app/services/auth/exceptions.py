class AuthError(Exception):
    status_code = 400

    def __init__(
        self,
        message: str = "Authentication error",
        status_code: int | None = None,
        details: dict | None = None,
    ):
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}


class InvalidCredentials(AuthError):
    status_code = 401

    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message)


class InactiveAccount(AuthError):
    status_code = 403

    def __init__(self, message: str = "Account is inactive"):
        super().__init__(message)


class NotApproved(AuthError):
    status_code = 403

    def __init__(self, message: str = "Account not approved", details: dict | None = None):
        super().__init__(message, details=details)
