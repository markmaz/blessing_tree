CREATE TABLE IF NOT EXISTS auth_password_reset_token (
    id BINARY(16) NOT NULL,
    user_id BINARY(16) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_password_reset_token_hash (token_hash),
    KEY idx_auth_password_reset_token_user (user_id),
    KEY idx_auth_password_reset_token_expires (expires_at),
    KEY idx_auth_password_reset_token_used (used_at),
    KEY idx_auth_password_reset_token_user_status (user_id, used_at, expires_at),
    CONSTRAINT fk_auth_password_reset_token_user
        FOREIGN KEY (user_id)
        REFERENCES app_user (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
