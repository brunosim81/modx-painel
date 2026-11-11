# Pedidos após apoio confirmado

1. O utilizador envia um apoio PayPal de pelo menos2EUR para o destinatário indicado na app. Um clique ou um recibo enviado pelo utilizador não valida o apoio.
2. O responsável entra na sua própria contaPayPal e confirma destinatário, transação concluída, moedaEUR e valor≥2. Não emitir códigos para pagamentos pendentes, outros destinatários ou montantes inferiores.
3. O responsável executa tools/emitir-codigo.mjs com DONOR_GRANT_SECRET no ambiente ou com o ficheiro privado.modx-support-admin.json fora do Git. Introduz a referência da transação, o valor e CONFIRMADO. A mesma referência gera o mesmo identificador de acesso.
4. O responsável entrega o código ao apoiante por um canal privado. Não publicar códigos/segredos no GitHub. A emissão não envia mensagens automaticamente.
5. O apoiante preenche código, email, título e descrição no formulário da app. O servidor valida assinatura, montante mínimo, moeda e prazo e guarda o pedido num Blobprivado com escrita sem sobrescrita. Reutilização devolve409; código falso/expirado devolve400. Sem configuração,503 e nenhum pedido aceite.

Cada apoio permite um pedido, código válido90dias. O código é pessoal e não deve ser partilhado. Se um pedido for aceite e a resposta de rede se perder, repetir poderá indicar código utilizado; o responsável pode confirmar o registo em vez de cobrar novamente.

Os pedidos privados ficam no armazenamentoVercelBlob do projeto, sob requests/. Acesso só pelo responsável autorizado. O código não contém a referência PayPal em claro; o registo inclui email, pedido, data e valor elegível. Não há consulta pública destes registos. Não recolher comprovativos ou dados bancários no formulário.

O serviço não consulta o PayPal automaticamente nem valida retroativamente estornos. O responsável deve verificar no PayPal antes de emitir o código. Não há garantia de implementação ou prazo, nem pagamento executado automaticamente.

Configuração servidor: DONOR_GRANT_SECRET, BLOB_READ_WRITE_TOKEN. Nunca incluir os valores na fonte, ZIP ou cacheoffline. A apppública não contém a ferramenta/configuração privada de emissão.
