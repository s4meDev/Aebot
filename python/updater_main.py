"""Lançador estável e atualizador independente; não carrego a IA neste processo."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
from aebot.updates import launch_application as launch


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--update', action='store_true')
    parser.add_argument('--root', type=Path)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--package', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--channel-job', type=Path)
    args = parser.parse_args()
    if args.channel_job:
        from aebot.channel_client import execute_job
        execute_job(args.channel_job)
        return
    own = Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path.cwd()
    root = args.root or own
    if args.root is None and not (own / 'resources').is_dir():
        from aebot.company_source import default_install_directory
        installed = default_install_directory()
        if (installed / 'AEBOT.exe').is_file():
            # O mesmo executável baixado pode abrir a instalação local nas
            # próximas vezes; não obrigo o analista a localizar AppData.
            root = installed
    if args.check:
        from aebot.channel_ui import ChannelWindow as UpdateWindow
        from aebot.updates import inspect_update
        report = dict(status='starting', ok=False)
        if args.report:
            args.report.write_text(json.dumps(report), encoding='utf-8')
        window = tk.Tk()
        window.withdraw()
        try:
            panel = UpdateWindow(window, initial_root=root, download_directory=own)
            if args.package:
                release = inspect_update(args.package)
                panel.package.set(str(args.package))
                panel.preview()
                if release.data['toVersion'] not in panel.status.get():
                    raise RuntimeError('A interface não exibiu a versão assinada.')
            window.update()
            if len(panel.controls) != 8:
                raise RuntimeError('Controles do atualizador incompletos.')
            report.update(status='completed', ok=True, interface=True,
                signedPackage=bool(args.package), noModelLoaded='onnxruntime' not in sys.modules)
        except Exception as error:
            report.update(status='failed', exception=type(error).__name__)
            raise
        finally:
            window.destroy()
            if args.report:
                args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
        return
    if not args.update and (root / 'AEBOT.exe').is_file():
        try:
            launch(root)
            return
        except Exception:
            window = tk.Tk()
            window.withdraw()
            messagebox.showerror('AEBOT não iniciado', 'Não consegui conferir a versão ativa. A instalação original foi preservada. Abra o atualizador para verificar ou voltar à versão anterior.', parent=window)
            window.destroy()
    from aebot.channel_ui import ChannelWindow as UpdateWindow
    window = tk.Tk()
    UpdateWindow(window, initial_root=root if (root / 'AEBOT.exe').is_file() else None, download_directory=own, auto_check=True)
    window.mainloop()


if __name__ == '__main__':
    main()
