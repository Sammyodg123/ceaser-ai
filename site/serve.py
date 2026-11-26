from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent.resolve()

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested = (ROOT / self.path.lstrip('/').split('?', 1)[0]).resolve()
        if self.path.startswith('/api/'):
            self.send_error(404, 'API unavailable in static preview')
            return
        if not requested.is_file() or requested.parent != ROOT:
            self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 3000), SPAHandler).serve_forever()
