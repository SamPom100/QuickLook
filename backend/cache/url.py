import requests
import logging
from .cache import _URLCacheDB

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO, 
    format='%(levelname)s: %(name)s: %(message)s'
)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': 'https://www.macrotrends.net/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
}

class URLCache:
    def __init__(self):
        self.url_cache_db = _URLCacheDB()

    def getURL(self, url: str) -> str:
        check = self.url_cache_db.get(url)
        if check is None:
            live = self.__getURL(url)
            self.url_cache_db.put(url, live)
            return live
        return check

    def __getURL(self, url: str) -> str:
        output = requests.get(url, headers=HEADERS)
        if output.status_code == 403:
            logger.error("403: Access Denied")
            raise Exception("403: Access Denied")
        if output.status_code == 200:
            return output.text
        logger.error("Unknown Exception: %s", output.status_code)
        raise Exception("Unknown Exception: " + str(output.status_code))

if __name__ == '__main__':
    raise Exception("Do not run this directly.")