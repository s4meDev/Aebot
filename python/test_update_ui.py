"""Confiro o espaço da janela do atualizador sem abrir a IA ou outro app."""
import json
import sys
import tkinter as tk
from aebot.channel_ui import ChannelWindow as UpdateWindow


def main():
    window = tk.Tk()
    panel = UpdateWindow(window)
    try:
        for size in ('560x480', '660x510', '1024x700'):
            window.geometry(size + '+20+20')
            panel.status.set('Conferindo pacote.\nVersão anterior preservada.\nFeedbacks não serão alterados.')
            window.update()
            for control in panel.controls:
                assert control.winfo_ismapped()
                assert control.winfo_rooty() + control.winfo_height() <= window.winfo_rooty() + window.winfo_height()
                assert control.winfo_rootx() + control.winfo_width() <= window.winfo_rootx() + window.winfo_width()
        assert 'onnxruntime' not in sys.modules
        print(json.dumps(dict(ok=True, sizes=3, noModelLoaded=True, controls=len(panel.controls))))
    finally:
        window.destroy()


if __name__ == '__main__':
    main()
