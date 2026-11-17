"""As cores ficam juntas para eu não precisar ajustar cada janela separada."""
import tkinter as tk
from tkinter import ttk

BG = '#F4F7FC'
SURFACE = '#FFFFFF'
FG = '#14264B'
MUTED = '#566985'
BLUE = '#102A91'
NAVY = '#070E73'
BORDER = '#D9E3F0'
SOFT_BLUE = '#EDF3FF'
GREEN = '#176044'
SOFT_GREEN = '#EAF5EF'
AMBER = '#805900'
SOFT_AMBER = '#FFF5DD'
RED = '#A12B3C'
SOFT_RED = '#FCEEF0'


def configure_theme(window):
    style = ttk.Style(window)
    style.theme_use('clam')
    style.configure('TCombobox', fieldbackground=SURFACE, background=SURFACE,
        foreground=FG, arrowcolor=BLUE, bordercolor=BORDER, lightcolor=BORDER,
        darkcolor=BORDER, padding=9)
    style.map('TCombobox', fieldbackground=[('readonly', SURFACE), ('disabled', BG)],
        foreground=[('readonly', FG), ('disabled', MUTED)],
        selectbackground=[('readonly', SURFACE)], selectforeground=[('readonly', FG)])
    style.configure('Treeview', background=SURFACE, fieldbackground=SURFACE,
        foreground=FG, borderwidth=0, rowheight=30, font=('Segoe UI', 10))
    style.configure('Treeview.Heading', background=SOFT_BLUE, foreground=NAVY,
        relief='flat', font=('Segoe UI', 10, 'bold'), padding=8)
    style.map('Treeview', background=[('selected', BLUE)], foreground=[('selected', SURFACE)])
    style.configure('Vertical.TScrollbar', background=BORDER, troughcolor=SURFACE,
        arrowcolor=MUTED, borderwidth=0)
    style.configure('Aebot.Horizontal.TProgressbar', background=BLUE, troughcolor=BG,
        borderwidth=0, thickness=3)
    window.option_add('*TCombobox*Listbox.background', SURFACE)
    window.option_add('*TCombobox*Listbox.foreground', FG)
    window.option_add('*TCombobox*Listbox.selectBackground', BLUE)
    window.option_add('*TCombobox*Listbox.selectForeground', SURFACE)


def button(parent, text, command, *, primary=False):
    return tk.Button(parent, text=text, command=command,
        bg=BLUE if primary else SURFACE, fg=SURFACE if primary else BLUE,
        activebackground=NAVY if primary else SOFT_BLUE,
        activeforeground=SURFACE if primary else NAVY,
        disabledforeground='#7A8AA6', relief='flat', bd=0, cursor='hand2',
        highlightthickness=1, highlightbackground=BLUE if primary else BORDER,
        highlightcolor=BLUE, padx=16, pady=9, font=('Segoe UI', 10, 'bold' if primary else 'normal'))
