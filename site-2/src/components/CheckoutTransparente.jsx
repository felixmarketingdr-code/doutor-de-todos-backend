import { useEffect, useRef, useState } from 'react';

import {

  ArrowLeft,

  ShieldCheck,

  CreditCard,

  QrCode,

  Barcode,

  Copy,

  CheckCircle2,

  LoaderCircle,

  AlertCircle,

  LockKeyhole,

} from 'lucide-react';

import './CheckoutTransparente.css';

// ==========================================

// CONFIGURAÇÕES

// ==========================================

const API_URL = (

  import.meta.env.VITE_API_URL ||

  'https://doutor-de-todos-backend.onrender.com'

).replace(/\/+$/, '');

const PAGARME_PUBLIC_KEY =

  import.meta.env.VITE_PAGARME_PUBLIC_KEY || '';

const METODOS = [

  {

    id: 'pix',

    nome: 'PIX',

    detalhe: 'Aprovação após confirmação',

    Icone: QrCode,

  },

  {

    id: 'credit_card',

    nome: 'Cartão de crédito',

    detalhe: 'Pagamento com cartão',

    Icone: CreditCard,

  },

  {

    id: 'boleto',

    nome: 'Boleto bancário',

    detalhe: 'Compensação bancária',

    Icone: Barcode,

  },

];

// ==========================================

// FUNÇÕES AUXILIARES

// ==========================================

function somenteNumeros(valor) {

  return String(valor || '').replace(/\D/g, '');

}

async function lerResposta(resposta) {

  const textoResposta = await resposta.text();

  try {

    return textoResposta ? JSON.parse(textoResposta) : {};

  } catch {

    throw new Error(

      `Resposta inválida do servidor. HTTP ${resposta.status}.`

    );

  }

}

function obterMensagemErro(dados) {

  return (

    dados?.error ||

    dados?.message ||

    dados?.mensagem ||

    'Não foi possível processar o pagamento. Tente novamente.'

  );

}

function formatarValidade(valor) {

  const numeros = somenteNumeros(valor).slice(0, 6);

  if (numeros.length <= 2) {

    return numeros;

  }

  return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;

}

function obterIdentificadorPedido(resultado) {

  return (

    resultado?.pedido?.id ||

    resultado?.order?.id ||

    resultado?.pedido?.order_id ||

    resultado?.pedidoId ||

    resultado?.pedido_id ||

    resultado?.order_id ||

    ''

  );

}

function formatarMoeda(valor) {

  return Number(valor).toLocaleString('pt-BR', {

    style: 'currency',

    currency: 'BRL',

  });

}

function obterValorPlano(plano) {

  if (plano === 'light') {

    return 139.80;

  }

  if (plano === 'plus') {

    return 958.80;

  }

  return 0;

}

// ==========================================

// COMPONENTE

// ==========================================

export default function CheckoutTransparente({

  dados = {},

  onVoltar,

  onPagamentoConfirmado,

  onDadosChange,

}) {

  const [metodo, setMetodo] = useState(dados.plano === 'light' ? 'credit_card' : 'pix');

  const [cartao, setCartao] = useState({

    titular: dados.nome || '',

    numero: '',

    validade: '',

    cvv: '',

  });

  const [resultado, setResultado] = useState(null);

  const [carregando, setCarregando] = useState(false);

  const [erro, setErro] = useState('');

  const [copiado, setCopiado] = useState(false);

  const [verificando, setVerificando] = useState(false);

  const [statusPagamento, setStatusPagamento] = useState('pendente');

  const notificouPagamento = useRef(false);

  const pedidoEmProcessamento = useRef(false);

  const cadastroId = dados.cadastroId;

  const pagamentoCriado = Boolean(resultado);

  // ==========================================

  // VALORES E PARCELAMENTO

  // ==========================================

  const parcelas =

    dados.plano === 'plus' ? 12 : 1;

  useEffect(() => {
    if (dados.plano === 'light') {
      setMetodo('credit_card');
    }
  }, [dados.plano]);

  const valorPlano =

    Number(dados.valor) > 0

      ? Number(dados.valor)

      : obterValorPlano(dados.plano);

  const nomePlano =

    dados.plano?.toUpperCase() || 'Não identificado';

  // ==========================================

  // ATUALIZAR DADOS

  // ==========================================

  const atualizarCartao = (campo, valor) => {

    setCartao((atual) => ({

      ...atual,

      [campo]: valor,

    }));

    setErro('');

  };

  const atualizarStatusCadastro = (novosDados) => {

    onDadosChange?.(novosDados);

  };

  // ==========================================

  // TOKENIZAÇÃO DO CARTÃO

  // ==========================================

  const gerarTokenCartao = async () => {

    if (!PAGARME_PUBLIC_KEY) {

      throw new Error(

        'A chave pública da Pagar.me não está configurada no site.'

      );

    }

    const numero = somenteNumeros(cartao.numero);

    const validade = somenteNumeros(cartao.validade);

    const cvv = somenteNumeros(cartao.cvv);

    if (cartao.titular.trim().length < 3) {

      throw new Error(

        'Informe o nome impresso no cartão.'

      );

    }

    if (numero.length < 13 || numero.length > 19) {

      throw new Error('Confira o número do cartão.');

    }

    if (validade.length !== 6) {

      throw new Error(

        'Informe a validade no formato MM/AAAA.'

      );

    }

    const mes = Number(validade.slice(0, 2));

    const ano = Number(validade.slice(2, 6));

    const agora = new Date();

    const anoAtual = agora.getFullYear();

    const mesAtual = agora.getMonth() + 1;

    if (

      mes < 1 ||

      mes > 12 ||

      ano < anoAtual ||

      (ano === anoAtual && mes < mesAtual)

    ) {

      throw new Error(

        'A validade do cartão está vencida ou incorreta.'

      );

    }

    if (cvv.length < 3 || cvv.length > 4) {

      throw new Error(

        'Confira o código de segurança do cartão.'

      );

    }

    const resposta = await fetch(

      `https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(

        PAGARME_PUBLIC_KEY

      )}`,

      {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

        },

        body: JSON.stringify({

          type: 'card',

          card: {

            number: numero,

            holder_name: cartao.titular.trim(),

            exp_month: mes,

            exp_year: ano,

            cvv,

          },

        }),

      }

    );

    const dadosToken = await lerResposta(resposta);

    if (!resposta.ok) {

      throw new Error(obterMensagemErro(dadosToken));

    }

    const token =

      dadosToken.id ||

      dadosToken.token?.id;

    if (!token) {

      throw new Error(

        'A Pagar.me não retornou o token do cartão.'

      );

    }

    return token;

  };

  // ==========================================

  // GERAR PAGAMENTO

  // ==========================================

  const gerarPagamento = async (event) => {

    event.preventDefault();

    if (

      carregando ||

      pagamentoCriado ||

      pedidoEmProcessamento.current

    ) {

      return;

    }

    setErro('');

    if (!cadastroId) {

      setErro(

        'Não encontramos o protocolo do cadastro. Volte e conclua o cadastro novamente.'

      );

      return;

    }

    if (!['light', 'plus'].includes(dados.plano)) {

      setErro(

        'Plano inválido. Volte e selecione seu plano.'

      );

      return;

    }

    try {

      setCarregando(true);

      pedidoEmProcessamento.current = true;

      let cardToken;

      if (metodo === 'credit_card') {

        cardToken = await gerarTokenCartao();

      }

      const corpo = {

        cadastroId,

        plano: dados.plano,

        paymentMethod: metodo,

        ...(cardToken

          ? {

              cardToken,

              installments: parcelas,

            }

          : {}),

      };

      const resposta = await fetch(

        `${API_URL}/api/pagarme/checkout`,

        {

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            Accept: 'application/json',

          },

          body: JSON.stringify(corpo),

        }

      );

      const dadosCheckout = await lerResposta(resposta);

      if (!resposta.ok) {

        throw new Error(obterMensagemErro(dadosCheckout));

      }

      const pedidoId = obterIdentificadorPedido(dadosCheckout);

      if (!pedidoId) {

        throw new Error(

          'O pagamento foi solicitado, mas o servidor não retornou o identificador do pedido. Não tente gerar outra cobrança antes de verificar o pedido.'

        );

      }

      setResultado(dadosCheckout);

      setStatusPagamento('pendente');

      notificouPagamento.current = false;

      atualizarStatusCadastro({

        statusPagamento: 'pendente',

        metodoPagamento: metodo,

        pedidoPagarme: pedidoId,

      });

    } catch (error) {

      console.error(

        'Erro ao gerar pagamento:',

        error

      );

      setErro(

        error.message || 'Erro ao gerar pagamento.'

      );

      pedidoEmProcessamento.current = false;

    } finally {

      setCarregando(false);

    }

  };

  // ==========================================

  // EXTRAÇÃO DOS DADOS DO PAGAMENTO

  // ==========================================

  const pagamento = resultado?.pagamento || {};

  const cobranca = resultado?.cobranca || {};

  const dadosPix =

    pagamento.pix ||

    resultado?.pix ||

    {};

  const dadosBoleto =

    pagamento.boleto ||

    resultado?.boleto ||

    {};

  // PIX COPIA E COLA

  const codigoPix =

    dadosPix.qrCode ||

    dadosPix.copiaECola ||

    dadosPix.copia_e_cola ||

    dadosPix.qr_code ||

    dadosPix.copy_paste ||

    pagamento.copia_e_cola ||

    pagamento.qr_code ||

    pagamento.qrCode ||

    pagamento.copy_paste ||

    cobranca.copia_e_cola ||

    cobranca.qr_code ||

    resultado?.copia_e_cola ||

    resultado?.qr_code ||

    resultado?.qrCode ||

    '';

  // IMAGEM DO QR CODE

  const imagemPix =

    dadosPix.qrCodeUrl ||

    dadosPix.qr_code_url ||

    dadosPix.url ||

    pagamento.qr_code_url ||

    pagamento.qrCodeUrl ||

    cobranca.qr_code_url ||

    resultado?.qr_code_url ||

    resultado?.qrCodeUrl ||

    '';

  // BOLETO

  const linkBoleto =

    dadosBoleto.url ||

    dadosBoleto.boleto_url ||

    dadosBoleto.pdf ||

    pagamento.boleto_url ||

    pagamento.url ||

    cobranca.boleto_url ||

    resultado?.boleto_url ||

    resultado?.boletoUrl ||

    '';

  const codigoBoleto =

    dadosBoleto.linhaDigitavel ||

    dadosBoleto.linha_digitavel ||

    dadosBoleto.codigoBarras ||

    dadosBoleto.barcode ||

    dadosBoleto.line ||

    pagamento.boleto_barcode ||

    pagamento.barcode ||

    pagamento.linha_digitavel ||

    cobranca.boleto_barcode ||

    resultado?.boleto_barcode ||

    resultado?.linha_digitavel ||

    '';

  // ==========================================

  // COPIAR CÓDIGO

  // ==========================================

  const copiarCodigo = async (textoCodigo) => {

    if (!textoCodigo) return;

    try {

      await navigator.clipboard.writeText(textoCodigo);

      setCopiado(true);

      window.setTimeout(() => {

        setCopiado(false);

      }, 2500);

    } catch {

      setErro(

        'Não foi possível copiar automaticamente. Selecione e copie o código.'

      );

    }

  };

  // ==========================================

  // CONSULTAR STATUS DO PAGAMENTO

  // A confirmação vem do backend, após webhook.

  // ==========================================

  useEffect(() => {

    if (!cadastroId || !pagamentoCriado) {

      return undefined;

    }

    let ativo = true;

    let temporizador = null;

    const verificarPagamento = async () => {

      if (!ativo) return;

      try {

        setVerificando(true);

        const resposta = await fetch(

          `${API_URL}/api/cadastros/${encodeURIComponent(cadastroId)}`,

          {

            method: 'GET',

            headers: {

              Accept: 'application/json',

            },

            cache: 'no-store',

          }

        );

        const dadosStatus = await lerResposta(resposta);

        if (!resposta.ok) {

          throw new Error(obterMensagemErro(dadosStatus));

        }

        if (!ativo) return;

        const status = String(

          dadosStatus.statusPagamento || ''

        ).toLowerCase();

        if (

          ['pago', 'paid', 'aprovado', 'aprovada'].includes(status)

        ) {

          setStatusPagamento('pago');

          if (!notificouPagamento.current) {

            notificouPagamento.current = true;

            const atualizacao = {

              statusPagamento: 'pago',

              statusCadastro: 'pagamento_confirmado',

              pedidoPagarme: obterIdentificadorPedido(resultado),

            };

            atualizarStatusCadastro(atualizacao);

            onPagamentoConfirmado?.(atualizacao);

          }

          return;

        }

        if (

          [

            'falhou',

            'failed',

            'recusado',

            'cancelado',

            'canceled',

          ].includes(status)

        ) {

          setStatusPagamento('falhou');

          return;

        }

      } catch (error) {

        console.error(

          'Erro ao consultar pagamento:',

          error

        );

      } finally {

        if (ativo) {

          setVerificando(false);

        }

      }

      // Consulta novamente somente enquanto estiver pendente.

      if (ativo && statusPagamento !== 'pago') {

        temporizador = window.setTimeout(

          verificarPagamento,

          5000

        );

      }

    };

    verificarPagamento();

    return () => {

      ativo = false;

      if (temporizador) {

        window.clearTimeout(temporizador);

      }

    };

  }, [cadastroId, pagamentoCriado, resultado, statusPagamento]);

  // ==========================================

  // INTERFACE

  // ==========================================

  return (

    <main className="checkout-pagina">

      <div className="checkout-container">

        <header className="checkout-cabecalho">

          <div className="checkout-selo">

            <ShieldCheck size={17} />

            PAGAMENTO SEGURO

          </div>

          <h1>Finalize sua contratação</h1>

          <p>

            Olá, <strong>{dados.nome || 'cliente'}</strong>!

            Seu cadastro está pronto.

            Agora escolha como deseja realizar o pagamento.

          </p>

        </header>

        {/* RESUMO */}

        <section

          className="checkout-resumo"

          aria-label="Resumo do cadastro"

        >

          <div className="checkout-resumo-item">

            <span>Seu plano</span>

            <strong>{nomePlano}</strong>

            <small>

              {dados.plano === 'light'
                  ? `Primeira cobrança: ${formatarMoeda(139.80)} • depois ${formatarMoeda(39.90)}/mês`
                  : `Valor anual: ${formatarMoeda(958.80)} • 12 parcelas de ${formatarMoeda(79.90)}`}

            </small>

          </div>

          <div className="checkout-resumo-item checkout-protocolo">

            <span>Protocolo do cadastro</span>

            <strong>

              {cadastroId || 'Não identificado'}

            </strong>

          </div>

        </section>

        {/* FORMULÁRIO */}

        {!pagamentoCriado && (

          <form

            onSubmit={gerarPagamento}

            className="checkout-formulario"

          >

            <section className="checkout-bloco">

              <div className="checkout-titulo-bloco">

                <span className="checkout-numero-etapa">

                  1

                </span>

                <div>

                  <h2>Escolha a forma de pagamento</h2>

                  <p>

                    Selecione a opção que preferir para continuar.

                  </p>

                </div>

              </div>

              <div className="checkout-metodos">

                {METODOS.filter((item) => dados.plano !== 'light' || item.id === 'credit_card').map((item) => {

                  const Icone = item.Icone;

                  const ativo = metodo === item.id;

                  return (

                    <button

                      type="button"

                      key={item.id}

                      className={`checkout-metodo ${ativo ? 'ativo' : ''}`}

                      aria-pressed={ativo}

                      onClick={() => {

                        setMetodo(item.id);

                        setErro('');

                      }}

                    >

                      <span className="checkout-metodo-icone">

                        <Icone size={24} />

                      </span>

                      <span className="checkout-metodo-texto">

                        <strong>{item.nome}</strong>

                        <small>{item.detalhe}</small>

                      </span>

                      <span

                        className="checkout-radio"

                        aria-hidden="true"

                      >

                        {ativo && <span />}

                      </span>

                    </button>

                  );

                })}

              </div>

            </section>

            {/* CARTÃO */}

            {metodo === 'credit_card' && (

              <section className="checkout-bloco checkout-cartao">

                <div className="checkout-titulo-bloco">

                  <span className="checkout-numero-etapa">

                    2

                  </span>

                  <div>

                    <h2>Dados do cartão</h2>

                    <p>

                      As informações são tokenizadas pela Pagar.me.

                    </p>

                  </div>

                </div>

                <label className="checkout-campo">

                  Nome impresso no cartão

                  <input

                    type="text"

                    autoComplete="cc-name"

                    value={cartao.titular}

                    onChange={(e) =>

                      atualizarCartao('titular', e.target.value)

                    }

                    placeholder="Nome como aparece no cartão"

                    required

                  />

                </label>

                <label className="checkout-campo">

                  Número do cartão

                  <input

                    type="text"

                    inputMode="numeric"

                    autoComplete="cc-number"

                    value={cartao.numero}

                    onChange={(e) =>

                      atualizarCartao(

                        'numero',

                        somenteNumeros(e.target.value).slice(0, 19)

                      )

                    }

                    placeholder="0000 0000 0000 0000"

                    required

                  />

                </label>

                <div className="checkout-grid">

                  <label className="checkout-campo">

                    Validade

                    <input

                      type="text"

                      inputMode="numeric"

                      autoComplete="cc-exp"

                      value={cartao.validade}

                      onChange={(e) =>

                        atualizarCartao(

                          'validade',

                          formatarValidade(e.target.value)

                        )

                      }

                      placeholder="MM/AAAA"

                      required

                    />

                  </label>

                  <label className="checkout-campo">

                    Código de segurança

                    <input

                      type="password"

                      inputMode="numeric"

                      autoComplete="cc-csc"

                      value={cartao.cvv}

                      onChange={(e) =>

                        atualizarCartao(

                          'cvv',

                          somenteNumeros(e.target.value).slice(0, 4)

                        )

                      }

                      placeholder="CVV"

                      required

                    />

                  </label>

                </div>

                <label className="checkout-campo">

                  Parcelamento

                  <input

                    type="text"

                    value={

                      dados.plano === 'plus'

                        ? '12 parcelas'

                        : '1 cobrança'

                    }

                    readOnly

                  />

                </label>

                <p className="checkout-nota-seguranca">

                  <LockKeyhole size={15} />

                  Os dados do cartão não são armazenados neste site.

                </p>

              </section>

            )}

            {/* PIX */}

            {metodo === 'pix' && (

              <div className="checkout-informacao">

                <QrCode size={25} />

                <div>

                  <strong>Pagamento via PIX</strong>

                  <p>

                    Ao continuar, vamos gerar o QR Code e o código PIX para copiar e colar.

                  </p>

                </div>

              </div>

            )}

            {/* BOLETO */}

            {metodo === 'boleto' && (

              <div className="checkout-informacao">

                <Barcode size={25} />

                <div>

                  <strong>Pagamento via boleto</strong>

                  <p>

                    Ao continuar, vamos gerar seu boleto bancário.

                  </p>

                </div>

              </div>

            )}

            {/* ERROS */}

            {erro && (

              <div className="checkout-erro" role="alert">

                <AlertCircle size={19} />

                <span>{erro}</span>

              </div>

            )}

            {/* BOTÕES */}

            <div className="checkout-acoes">

              {onVoltar && (

                <button

                  type="button"

                  className="checkout-voltar"

                  onClick={onVoltar}

                  disabled={carregando}

                >

                  <ArrowLeft size={18} />

                  Voltar

                </button>

              )}

              <button

                type="submit"

                className="checkout-continuar"

                disabled={carregando}

              >

                {carregando ? (

                  <>

                    <LoaderCircle

                      className="checkout-girando"

                      size={20}

                    />

                    GERANDO PAGAMENTO...

                  </>

                ) : (

                  <>

                    GERAR PAGAMENTO

                    <ShieldCheck size={19} />

                  </>

                )}

              </button>

            </div>

            <div className="checkout-seguranca">

              <LockKeyhole size={16} />

              <span>

                Ambiente de pagamento protegido pela Pagar.me.

              </span>

            </div>

          </form>

        )}

        {/* RESULTADO DO PAGAMENTO */}

        {pagamentoCriado && (

          <section className="checkout-bloco checkout-resultado">

            {/* PIX */}

            {metodo === 'pix' && (

              <>

                <div className="checkout-resultado-icone">

                  <QrCode size={30} />

                </div>

                <h2>Pagamento via PIX</h2>

                <p>

                  Escaneie o QR Code pelo aplicativo do seu banco ou copie o código PIX.

                </p>

                {imagemPix && (

                  <div className="checkout-qr-area">

                    <img

                      className="checkout-qr-imagem"

                      src={imagemPix}

                      alt="QR Code para pagamento PIX"

                    />

                  </div>

                )}

                {codigoPix && (

                  <div className="checkout-codigo">

                    <label htmlFor="checkout-codigo-pix">

                      PIX copia e cola

                    </label>

                    <textarea

                      id="checkout-codigo-pix"

                      readOnly

                      value={codigoPix}

                      rows={4}

                    />

                    <button

                      type="button"

                      onClick={() => copiarCodigo(codigoPix)}

                    >

                      {copiado

                        ? <CheckCircle2 size={18} />

                        : <Copy size={18} />}

                      {copiado

                        ? 'COPIADO'

                        : 'COPIAR CÓDIGO PIX'}

                    </button>

                  </div>

                )}

                {!imagemPix && !codigoPix && (

                  <p className="checkout-aviso">

                    O pedido foi criado, mas o backend não retornou os dados do QR Code. Não gere outra cobrança antes de verificar o pedido.

                  </p>

                )}

              </>

            )}

            {/* BOLETO */}

            {metodo === 'boleto' && (

              <>

                <div className="checkout-resultado-icone">

                  <Barcode size={30} />

                </div>

                <h2>Boleto gerado</h2>

                <p>

                  Utilize o código abaixo ou abra o boleto para realizar o pagamento.

                </p>

                {codigoBoleto && (

                  <div className="checkout-codigo">

                    <label htmlFor="checkout-codigo-boleto">

                      Código do boleto

                    </label>

                    <textarea

                      id="checkout-codigo-boleto"

                      readOnly

                      value={codigoBoleto}

                      rows={3}

                    />

                    <button

                      type="button"

                      onClick={() => copiarCodigo(codigoBoleto)}

                    >

                      {copiado

                        ? <CheckCircle2 size={18} />

                        : <Copy size={18} />}

                      {copiado

                        ? 'COPIADO'

                        : 'COPIAR CÓDIGO'}

                    </button>

                  </div>

                )}

                {linkBoleto && (

                  <a

                    className="checkout-link-boleto"

                    href={linkBoleto}

                    target="_blank"

                    rel="noopener noreferrer"

                  >

                    <Barcode size={18} />

                    ABRIR BOLETO

                  </a>

                )}

                {!codigoBoleto && !linkBoleto && (

                  <p className="checkout-aviso">

                    O pedido foi criado, mas o backend não retornou o link ou código do boleto.

                  </p>

                )}

              </>

            )}

            {/* CARTÃO */}

            {metodo === 'credit_card' && (

              <>

                <div className="checkout-resultado-icone">

                  <CreditCard size={30} />

                </div>

                <h2>Cartão enviado para processamento</h2>

                <p>

                  Estamos aguardando a confirmação do pagamento pela operadora.

                </p>

              </>

            )}

            {/* STATUS */}

            <div

              className={`checkout-status checkout-status-${statusPagamento}`}

            >

              {statusPagamento === 'pago' ? (

                <>

                  <CheckCircle2 size={22} />

                  <strong>Pagamento confirmado!</strong>

                </>

              ) : statusPagamento === 'falhou' ? (

                <>

                  <AlertCircle size={22} />

                  <strong>

                    Pagamento não aprovado ou cancelado.

                  </strong>

                </>

              ) : (

                <>

                  <LoaderCircle

                    size={21}

                    className="checkout-girando"

                  />

                  <strong>

                    Aguardando confirmação do pagamento...

                  </strong>

                </>

              )}

            </div>

            {statusPagamento === 'pendente' && (

              <p className="checkout-ajuda">

                {verificando

                  ? 'Consultando o status do pagamento...'

                  : 'A confirmação pode levar alguns instantes. Não feche esta página.'}

              </p>

            )}

            {statusPagamento === 'falhou' && (
              <p className="checkout-aviso">
                O pagamento não foi aprovado ou foi cancelado. Antes de tentar novamente,
                confirme no atendimento se não existe uma cobrança ou assinatura anterior
                vinculada ao seu cadastro.
              </p>
            )}

          </section>

        )}

      </div>

    </main>

  );

}
