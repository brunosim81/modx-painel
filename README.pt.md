# MODX Painel

Aplicação independente para Yamaha MODX6+, com vistas **Performance** e **Painel físico**, edição e leitura por USB MIDI/SysEx.

**Abrir:** https://modx-painel.vercel.app

## iPad

Usa MIDIWeb Browser, iPadOS17.6+ e cabo de dados iPad → MODX **USB TO HOST**. No teclado: Utility → Settings → MIDI I/O → MIDI IN/OUT = USB. Autoriza MIDI/SysEx, verifica o diagnóstico e toca Ligar ao MODX. Safari/Chrome no iPad não fornecem este acesso Web MIDI por si só.

Em Offline / atualizações prepara a cache e espera por Cópia offline pronta. Importa a bibliotecaJSON se necessário, exporta uma cópia para Ficheiros e testa reabrir com Wi-Fi/dados móveis desligados, mantendo USB. A pesquisa online e o envio de pedidos requerem Internet. Limpar a cache pode apagar dados do browser. Sem Mac/PC após preparação.

Teste seguro: anota um volume de Part, aumenta1 na app e repõe, aguardando Valor confirmado pelo MODX em ambas. Depois altera no teclado e confirma as duas vistas. Se uma ação não emitir MIDI, usa Ler teclado. Não uses Store no teste.

## Windows10/11 x64

Descarrega o ZIP da release mais recente, extrai-o por completo e executa windows\Instalar.cmd. Abre pelo atalho ou windows\Abrir.cmd, com Chrome instalado. O runtimeNode e respetiva licença acompanham o ZIP. windows\Verificar.cmd faz diagnóstico local. Liga o MODX por USB e instala o Yamaha Steinberg USB Driver oficial, se necessário.

## Conteúdo e limites

A distribuição é genérica: presets de fábrica e aplicação. Não inclui o User1 do autor, repertório Cão de Bila, backups, ficheiros.syx pessoais ou amostras. A bibliotecaJSON referencia sons já presentes no instrumento; não contém os sons. A PWA não grava Store nem atualiza firmware automaticamente.

Smart Morph e edição de amostras não têm paridade integral com o teclado. O teste físico desta versão em iPad/MIDIWeb/USB continua pendente. Testes automatizados e simulação no browser não provam esse funcionamento.

## Apoios e pedidos

[Apoiar e enviar um pedido](https://modx-painel.vercel.app/#apoios). O painel continua gratuito. Um apoio confirmado no PayPal, em EUR e de pelo menos2€, permite receber um código para **um** pedido de desenvolvimento. Validação manual pelo responsável; código de uso único,90dias. Apoio não garante implementação nem prazo. O responsável acompanha pedidos numa área privada; não publiques recibos ou email nos Issues.

Vê [PEDIDOS-APOIANTES.md](PEDIDOS-APOIANTES.md). Para problemas na app podem ser usados os Issues; propostas de desenvolvimento de apoiantes são aceites apenas pelo formulário com código validado.

## Fonte e distribuição

Código e ficheiros públicos desta release estão neste repositório. Não foi atribuída uma licença open-source por defeito; direitos de terceiros não são transferidos. As Releases têm o ZIPWindows genérico e SHA256SUMS. Mantém-se apenas o ZIPWindows mais recente na distribuição local.
