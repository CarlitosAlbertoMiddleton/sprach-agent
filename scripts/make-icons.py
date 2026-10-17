"""Generates the app and tray icons (simple speech bubble) without extra libraries."""
import struct, zlib, sys

def png(size, rgb, path):
    r0, g0, b0 = rgb
    rows = []
    c = size / 2
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            # rounded bubble body plus a small tail bottom-left
            dx, dy = (x + .5 - c) / size, (y + .5 - c * .9) / size
            inside = dx * dx / .2 + dy * dy / .14 < 1
            tail = 0.16 * size < x < 0.36 * size and 0.7 * size < y < 0.92 * size and (x - .16 * size) > (y - .7 * size) * .9
            # three white dots
            dot = any(((x + .5) - (c + k * .2 * size)) ** 2 + ((y + .5) - c * .9) ** 2 < (.06 * size) ** 2 for k in (-1, 0, 1))
            if dot and inside:
                row += bytes([255, 255, 255, 255])
            elif inside or tail:
                row += bytes([r0, g0, b0, 255])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

png(256, (59, 91, 219), 'assets/icon.png')
png(32, (59, 91, 219), 'assets/tray-idle.png')
png(32, (34, 160, 90), 'assets/tray-active.png')
