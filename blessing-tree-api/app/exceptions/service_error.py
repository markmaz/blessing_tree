class ServiceError(Exception):
    """
    Custom exception for service layer errors.
    """
    def __init__(self, message, status_code=400, details=None):
        """
        :param message: Error message string.
        :param status_code: HTTP status code (default: 400).
        :param details: Optional additional details (should be JSON serializable).
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details if details else {}  # Ensure details is a dict

    def __str__(self):
        return str(self.message)

    def to_dict(self):
        """
        Convert the exception into a JSON-serializable dictionary.
        """
        return {
            "error": self.message,
            "status_code": self.status_code,
            "details": self.details  # Make sure details is always serializable
        }
