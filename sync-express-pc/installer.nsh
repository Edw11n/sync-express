!macro customInstall
  # 1. Regla TCP para el puerto 6402 (Servidor HTTP y WebSockets)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Sync Express LAN TCP" dir=in action=allow protocol=TCP localport=6402 program="$INSTDIR\Sync Express.exe" enable=yes'

  # 2. Regla UDP para el puerto 6403 (Descubrimiento por Broadcast)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Sync Express LAN UDP" dir=in action=allow protocol=UDP localport=6403 program="$INSTDIR\Sync Express.exe" enable=yes'
!macroend

!macro customUnInstall
  # 1. Limpieza de la regla TCP al desinstalar
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Sync Express LAN TCP" program="$INSTDIR\Sync Express.exe"'

  # 2. Limpieza de la regla UDP al desinstalar
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Sync Express LAN UDP" program="$INSTDIR\Sync Express.exe"'
!macroend