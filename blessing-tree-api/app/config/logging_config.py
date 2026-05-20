import logging
import os

from dotenv import load_dotenv


def configure_logging():
    load_dotenv()
    log_file = os.getenv("LOG_FILE", "default_log")
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        level=logging.DEBUG,
        handlers=[logging.FileHandler(log_file, mode="a"), logging.StreamHandler()],
    )
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.info("Global logging configured.")