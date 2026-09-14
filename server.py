"""Statický server pro lokální náhled.

Proti python -m http.server dělá dvě věci navíc:
  * posílá Cache-Control: no-store, takže prohlížeč po úpravě CSS/JS
    nedrží starou verzi;
  * adresář dostane napřímo, nikdy se neptá na os.getcwd() — projekt leží
    v iCloud Drive, kde macOS procesu vestavěného náhledu getcwd() zakazuje.

Použití:  python3 server.py <adresář> [port]
"""
import functools
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    directory = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8794
    handler = functools.partial(Handler, directory=directory)
    http.server.test(HandlerClass=handler, port=port, bind="127.0.0.1")


if __name__ == "__main__":
    main()
