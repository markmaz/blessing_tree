
import logging
logger = logging.getLogger(__name__)

def build_url(*parms: str) -> str:
    """
    Constructs a URL by joining parameters with "/".
    
    :param parms: Variable number of string arguments representing URL segments
    :return: A formatted URL string
    """
    url =  "/".join(str(parm) for parm in parms)
    logger.info(url)
    return url