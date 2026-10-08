@echo off
setlocal
rem Abre o prototipo ja compilado no workspace, sem pedir chave, URL ou porta.
rem Usa o Electron instalado. Nao substitui o Setup assinado da TI.
cd /d "%~dp0" || exit /b 1
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron nao encontrado. Prepare o projeto com npm.cmd ci.
  pause
  exit /b 1
)
if not exist "desktop-dist\main.cjs" (
  echo Aplicativo nao compilado. Execute npm.cmd run desktop:build.
  pause
  exit /b 1
)
start "" /b "node_modules\electron\dist\electron.exe" "."
