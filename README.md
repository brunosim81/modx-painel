# MODX Panel

An independent Yamaha MODX6+ controller with **Performance** and **Physical panel** views, bidirectional USB MIDI/SysEx editing and an offline app shell.

**Open:** https://modx-painel.vercel.app

English is the default. Use **Language / Idioma** to switch to Portuguese. The selection is stored on your device and works offline. Performance names, user text and MIDI values are preserved.

## iPad

Use MIDIWeb Browser (iPadOS17.6+), a data cable to the keyboard’s **USB TO HOST** port, and MIDI IN/OUT=USB on the MODX. Allow MIDI/SysEx, run USB diagnostics, then Connect to MODX. Safari and Chrome on iPad do not provide this MIDI access by themselves.

Under Offline / updates, prepare the cache and wait for Offline copy ready. Import your local catalog if needed and export a backup to Files. Test reopening with Wi-Fi/mobile data disabled while keeping USB connected. New sound searches and support requests require internet. Browser storage may be cleared by the OS. No computer is required after preparation.

Safe test: note one Part volume, increase it by one step and restore it, waiting for Value confirmed by MODX both times. Then change it on the keyboard and check both views. Use Read keyboard for actions that do not emit MIDI. Do not press Store during this test.

## Windows10/11 x64

Download the latest release ZIP, extract the entire archive and run windows\Instalar.cmd. Open the installed shortcut or windows\Abrir.cmd with Chrome installed. The Node runtime and license are included. windows\Verificar.cmd performs local diagnostics. Connect by USB and install Yamaha’s official Steinberg USB driver if required.

## Support and development requests

[Support / request form](https://modx-painel.vercel.app/#apoios). The controller remains free. A **manually verified PayPal payment of at least €2, in EUR**, qualifies for one single-use code allowing one development request within90days. The maintainer checks the actual payment before issuing the code. A click or a user-provided screenshot is not accepted as proof. Support does not guarantee implementation or a deadline.

Codes and request data are verified/stored on the server. Requests remain private. Invalid, expired or reused codes are rejected. Do not post payment receipts, email addresses or codes in GitHub Issues. Issues are for bug reports; supporter development requests use the protected form. See [maintainer instructions](PEDIDOS-APOIANTES.md).

## Distribution and limitations

This is a generic distribution. It excludes the author’s User1, private setlist, backups, personal.syx files and samples. Local catalogJSON references sounds already installed on the keyboard; it does not contain audio. The app does not execute Store or firmware updates automatically.

Smart Morph and native sample editing do not have full keyboard parity. Physical iPad/MIDIWeb/USB testing of this revision is pending. Automated tests and browser simulations are not hardware proof.

No open-source license has been assigned by default; third-party rights are not transferred. This is not an official Yamaha or PayPal product. Releases include a generic Windows ZIP and SHA256SUMS. Only the newest Windows ZIP is retained locally.

[Português](README.pt.md)
