; O modelo ultrapassa o limite de 2 GB do NSIS embutido. Vai ao lado do setup.
; Não existe download durante a instalação: a TI entrega os dois arquivos juntos.
!macro customInit
  IfFileExists "$EXEDIR\Qwen3-4B-Q4_K_M.gguf" model_available
    MessageBox MB_OK|MB_ICONSTOP "Pacote AEBOT incompleto. Coloque Qwen3-4B-Q4_K_M.gguf na mesma pasta deste instalador e tente novamente." /SD IDOK
    Abort
  model_available:
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR\resources\local-ai\models"
  ClearErrors
  CopyFiles /SILENT "$EXEDIR\Qwen3-4B-Q4_K_M.gguf" "$INSTDIR\resources\local-ai\models\Qwen3-4B-Q4_K_M.gguf"
  IfErrors 0 model_copied
    MessageBox MB_OK|MB_ICONSTOP "Falha ao copiar o modelo. Confira o espaço livre e solicite o pacote completo à TI." /SD IDOK
    Abort
  model_copied:
!macroend
