
import { useState, useRef } from 'react';

import {
  User,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  LoaderCircle,
  AlertCircle,
  ClipboardList,
  LockKeyhole,
  Zap,
} from 'lucide-react';

import './EtapaCadastro.css';

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://doutor-de-todos-backend.onrender.com'
).replace(/\/+$/, '');

// ==========================================
// ESTADOS DO BRASIL
// ==========================================

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF',
  'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
  'RO', 'RR', 'SC', 'SE', 'SP', 'TO',
];

// ==========================================
// ESTADO INICIAL
// ==========================================

const ESTADO_INICIAL = {
  nome: '',
  cpf: '',
  dataNascimento: '',
  email: '',
  celular: '',
  telefone: '',

  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',

  numeroInstalacao: '',
  numeroClienteEnel: '',
};

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function textoSeguro(valor) {
  return String(valor ?? '').trim();
}

function somenteNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function validarCPF(cpf) {
  const numero = somenteNumeros(cpf);

  if (
    numero.length !== 11 ||
    /^(\d)\1+$/.test(numero)
  ) {
    return false;
  }

  let soma = 0;

  for (let i = 0; i < 9; i++) {
    soma += Number(numero[i]) * (10 - i);
  }

  let digito = (soma * 10) % 11;

  if (digito === 10) digito = 0;

  if (digito !== Number(numero[9])) {
    return false;
  }

  soma = 0;

  for (let i = 0; i < 10; i++) {
    soma += Number(numero[i]) * (11 - i);
  }

  digito = (soma * 10) % 11;

  if (digito === 10) digito = 0;

  return digito === Number(numero[10]);
}

function formatarCPF(valor) {
  return somenteNumeros(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarTelefone(valor) {
  const numero = somenteNumeros(valor).slice(0, 11);

  if (numero.length <= 10) {
    return numero
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return numero
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function formatarCEP(valor) {
  return somenteNumeros(valor)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

async function lerResposta(resposta) {
  const texto = await resposta.text();

  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new Error(
      `O servidor retornou uma resposta inválida. HTTP ${resposta.status}.`
    );
  }
}

// ==========================================
// COMPONENTE
// ==========================================

export default function EtapaCadastro({
  onVoltar,
  onAvancar,
  dados = {},
  onDadosChange,
}) {
  const [formulario, setFormulario] = useState(() => {
    const dadosSeguros = Object.fromEntries(
      Object.entries(dados || {}).filter(
        ([, valor]) => valor !== undefined && valor !== null
      )
    );

    return {
      ...ESTADO_INICIAL,
      ...dadosSeguros,

      endereco:
        dadosSeguros.endereco ||
        dadosSeguros.logradouro ||
        '',

      numeroInstalacao:
        dadosSeguros.numeroInstalacao ||
        dadosSeguros.energia?.numeroInstalacao ||
        '',

      numeroClienteEnel:
        dadosSeguros.numeroClienteEnel ||
        dadosSeguros.energia?.numeroCliente ||
        '',
    };
  });

  const [aceitouPrivacidade, setAceitouPrivacidade] =
    useState(Boolean(dados.consentimentoPrivacidade));

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const envioEmAndamento = useRef(false);

  const pagamentoEnergia = dados.pagamento === 'energia';

  // ==========================================
  // ATUALIZAÇÃO DOS CAMPOS
  // ==========================================

  const atualizarCampo = (campo, valor) => {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor ?? '',
    }));

    setErro('');
  };

  // ==========================================
  // VALIDAÇÃO
  // ==========================================

  const validarFormulario = () => {
    if (!textoSeguro(formulario.nome)) {
      return 'Informe o nome completo do titular.';
    }

    if (textoSeguro(formulario.nome).split(/\s+/).length < 2) {
      return 'Informe o nome e sobrenome.';
    }

    if (!validarCPF(formulario.cpf)) {
      return 'Informe um CPF válido.';
    }

    if (!formulario.dataNascimento) {
      return 'Informe a data de nascimento.';
    }

    const nascimento = new Date(
      formulario.dataNascimento + 'T00:00:00'
    );

    if (
      Number.isNaN(nascimento.getTime()) ||
      nascimento > new Date()
    ) {
      return 'Informe uma data de nascimento válida.';
    }

    if (!textoSeguro(formulario.estado)) {
      return 'Informe o estado.';
    }

    if (!textoSeguro(formulario.cidade)) {
      return 'Informe a cidade.';
    }

    if (somenteNumeros(formulario.telefone).length < 10) {
      return 'Informe um telefone válido com DDD.';
    }

    if (somenteNumeros(formulario.celular).length < 10) {
      return 'Informe um celular válido com DDD.';
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        textoSeguro(formulario.email)
      )
    ) {
      return 'Informe um e-mail válido.';
    }

    // ======================================
    // ENDEREÇO PARA INTEGRAÇÃO COM A GESTÃO
    // ======================================

    if (somenteNumeros(formulario.cep).length !== 8) {
      return 'Informe um CEP válido com 8 números.';
    }

    if (!textoSeguro(formulario.endereco)) {
      return 'Informe o nome da rua ou avenida.';
    }

    if (!textoSeguro(formulario.numero)) {
      return 'Informe o número do endereço.';
    }

    if (!textoSeguro(formulario.bairro)) {
      return 'Informe o bairro.';
    }

    // ======================================
    // DADOS ENEL
    // ======================================

    if (pagamentoEnergia) {
      if (
        somenteNumeros(formulario.numeroInstalacao).length < 5
      ) {
        return 'Informe um número de instalação ENEL válido.';
      }

      if (
        somenteNumeros(formulario.numeroClienteEnel).length < 5
      ) {
        return 'Informe um número de cliente ENEL válido.';
      }
    }

    if (!aceitouPrivacidade) {
      return 'É necessário aceitar o aviso de privacidade.';
    }

    if (!['light', 'plus'].includes(dados.plano)) {
      return 'Plano não identificado. Volte e selecione seu plano.';
    }

    if (!['cartao', 'energia'].includes(dados.pagamento)) {
      return 'Forma de pagamento não identificada.';
    }

    return '';
  };

  // ==========================================
  // MONTAGEM DOS DADOS DO CLIENTE
  // ==========================================

  const montarDadosCliente = () => {
    const cliente = {
      nome: textoSeguro(formulario.nome),
      cpf: somenteNumeros(formulario.cpf),
      dataNascimento: textoSeguro(formulario.dataNascimento),

      email: textoSeguro(formulario.email).toLowerCase(),

      celular: somenteNumeros(formulario.celular),
      telefone: somenteNumeros(formulario.telefone),

      cep: somenteNumeros(formulario.cep),

      endereco: textoSeguro(formulario.endereco),
      logradouro: textoSeguro(formulario.endereco),

      numero: textoSeguro(formulario.numero),
      complemento: textoSeguro(formulario.complemento),
      bairro: textoSeguro(formulario.bairro),

      cidade: textoSeguro(formulario.cidade),
      estado: textoSeguro(formulario.estado).toUpperCase(),
      uf: textoSeguro(formulario.estado).toUpperCase(),

      plano: dados.plano,
      pagamento: dados.pagamento,

      origem: 'site_doutor_de_todos',

      consentimentoPrivacidade: true,
      dataConsentimento: new Date().toISOString(),
    };

    if (pagamentoEnergia) {
      cliente.energia = {
        concessionaria: 'ENEL',

        numeroInstalacao: somenteNumeros(
          formulario.numeroInstalacao
        ),

        numeroCliente: somenteNumeros(
          formulario.numeroClienteEnel
        ),

        titular: textoSeguro(formulario.nome),
      };
    }

    return cliente;
  };

  // ==========================================
  // ENVIO DO CADASTRO
  // ==========================================

  const enviarCadastro = async (event) => {
    event.preventDefault();

    if (envioEmAndamento.current || carregando) {
      return;
    }

    const mensagemErro = validarFormulario();

    if (mensagemErro) {
      setErro(mensagemErro);
      return;
    }

    try {
      envioEmAndamento.current = true;

      setCarregando(true);
      setErro('');

      const cliente = montarDadosCliente();

      // --------------------------------------
      // REGISTRA NO BACKEND E FIREBASE
      // --------------------------------------

      const respostaCadastro = await fetch(
        `${API_URL}/api/cadastros`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(cliente),
        }
      );

      const resultadoCadastro = await lerResposta(
        respostaCadastro
      );

      if (!respostaCadastro.ok) {
        const campos = Array.isArray(resultadoCadastro.campos)
          ? resultadoCadastro.campos.join(', ')
          : '';

        throw new Error(
          campos
            ? `${resultadoCadastro.error || 'Cadastro incompleto.'} Campos: ${campos}`
            : resultadoCadastro.error ||
              resultadoCadastro.message ||
              'Não foi possível registrar o cadastro.'
        );
      }

      // --------------------------------------
      // RECUPERA O ID GERADO PELO BACKEND
      // --------------------------------------

      const cadastroId =
        resultadoCadastro.cadastroId ||
        resultadoCadastro.id ||
        resultadoCadastro.cadastro?.id ||
        resultadoCadastro.cadastro?.cadastroId;

      if (!cadastroId) {
        throw new Error(
          'O cadastro foi enviado, mas o backend não retornou o identificador. Verifique o cadastro no sistema antes de enviar novamente.'
        );
      }

      // --------------------------------------
      // ATUALIZA OS DADOS COMPARTILHADOS
      // --------------------------------------

      const dadosAtualizados = {
        ...cliente,

        cadastroId,

        statusCadastro: 'registrado',
        statusPagamento: 'pendente',
        statusContrato: 'pendente_auditoria',

        metodoPagamento: dados.pagamento,
      };

      onDadosChange?.(dadosAtualizados);

      // --------------------------------------
      // ENERGIA: FINALIZA CADASTRO
      // --------------------------------------

      if (pagamentoEnergia) {
        onAvancar?.();
        return;
      }

      // --------------------------------------
      // CARTÃO: SEGUE PARA CHECKOUT
      // --------------------------------------

      onAvancar?.();

    } catch (error) {
      console.error('Erro no cadastro:', error);

      setErro(
        error.message || 'Ocorreu um erro inesperado.'
      );
    } finally {
      setCarregando(false);
      envioEmAndamento.current = false;
    }
  };

  // ==========================================
  // CAMPOS AUXILIARES
  // ==========================================

  const campoTexto = (
    campo,
    titulo,
    placeholder = '',
    opcoes = {}
  ) => (
    <label
      className={`cadastro-campo ${
        opcoes.completo ? 'cadastro-campo-completo' : ''
      }`}
    >
      {titulo}

      <input
        type={opcoes.tipo || 'text'}
        value={formulario[campo] ?? ''}
        onChange={(e) => atualizarCampo(campo, e.target.value)}
        placeholder={placeholder}
        required={opcoes.obrigatorio !== false}
        autoComplete={opcoes.autoComplete || 'off'}
        maxLength={opcoes.maxLength}
        inputMode={opcoes.inputMode}
      />
    </label>
  );

  const campoSelect = (campo, titulo, opcoes) => (
    <label className="cadastro-campo">
      {titulo}

      <select
        value={formulario[campo] ?? ''}
        onChange={(e) => atualizarCampo(campo, e.target.value)}
        required
      >
        <option value="">Selecione uma opção</option>

        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <main className="cadastro-pagina">
      <div className="cadastro-container">

        <header className="cadastro-cabecalho">
          <span className="cadastro-etiqueta">
            {pagamentoEnergia
              ? 'ÚLTIMA ETAPA DO CADASTRO'
              : 'ÚLTIMA ETAPA ANTES DO PAGAMENTO'}
          </span>

          <h1>Vamos fazer seu cadastro?</h1>

          <p>
            Preencha seus dados corretamente para registrar
            sua contratação e continuar para a próxima etapa.
          </p>
        </header>

        {/* RESUMO DO PLANO */}

        <div className="cadastro-resumo">
          <ShieldCheck size={23} />

          <div>
            <strong>
              Plano {dados.plano?.toUpperCase() || 'Não selecionado'}
            </strong>

            <span>
              Pagamento:{' '}
              {dados.pagamento === 'cartao'
                ? 'Checkout de pagamento'
                : dados.pagamento === 'energia'
                  ? 'Conta de energia - ENEL'
                  : 'Não selecionado'}
            </span>
          </div>
        </div>

        <form onSubmit={enviarCadastro} noValidate>

          {/* DADOS PESSOAIS */}

          <section className="cadastro-bloco">
            <div className="cadastro-bloco-titulo">
              <User size={21} />

              <div>
                <h2>Dados pessoais</h2>
                <p>Informe os dados do titular da contratação.</p>
              </div>
            </div>

            <div className="cadastro-grid">
              {campoTexto(
                'nome',
                'Nome completo do titular *',
                'Digite seu nome completo',
                {
                  completo: true,
                  autoComplete: 'name',
                }
              )}

              <label className="cadastro-campo">
                CPF do titular *

                <input
                  type="text"
                  value={formulario.cpf ?? ''}
                  onChange={(e) =>
                    atualizarCampo(
                      'cpf',
                      formatarCPF(e.target.value)
                    )
                  }
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
              </label>

              <label className="cadastro-campo">
                Data de nascimento *

                <input
                  type="date"
                  value={formulario.dataNascimento ?? ''}
                  onChange={(e) =>
                    atualizarCampo(
                      'dataNascimento',
                      e.target.value
                    )
                  }
                  required
                />
              </label>
            </div>
          </section>

          {/* ENDEREÇO */}

          <section className="cadastro-bloco">
            <div className="cadastro-bloco-titulo">
              <MapPin size={21} />

              <div>
                <h2>Endereço completo</h2>
                <p>
                  Informe o endereço do titular para registrar sua contratação.
                </p>
              </div>
            </div>

            <div className="cadastro-grid">

              <label className="cadastro-campo">
                CEP *

                <input
                  type="text"
                  value={formulario.cep ?? ''}
                  onChange={(e) =>
                    atualizarCampo(
                      'cep',
                      formatarCEP(e.target.value)
                    )
                  }
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  required
                />
              </label>

              {campoTexto(
                'endereco',
                'Rua / Avenida *',
                'Nome da rua ou avenida',
                {
                  completo: true,
                  autoComplete: 'street-address',
                }
              )}

              {campoTexto(
                'numero',
                'Número *',
                'Número do imóvel'
              )}

              {campoTexto(
                'complemento',
                'Complemento',
                'Apartamento, bloco, casa etc.',
                {
                  obrigatorio: false,
                }
              )}

              {campoTexto(
                'bairro',
                'Bairro *',
                'Informe o bairro'
              )}

              {campoTexto(
                'cidade',
                'Cidade *',
                'Sua cidade'
              )}

              {campoSelect(
                'estado',
                'Estado / UF *',
                ESTADOS_BRASIL
              )}

            </div>
          </section>

          {/* CONTATO */}

          <section className="cadastro-bloco">
            <div className="cadastro-bloco-titulo">
              <Phone size={21} />

              <div>
                <h2>Informações de contato</h2>
                <p>
                  Utilizaremos esses dados para falar com você.
                </p>
              </div>
            </div>

            <div className="cadastro-grid">

              <label className="cadastro-campo">
                Telefone *

                <input
                  type="tel"
                  value={formulario.telefone ?? ''}
                  onChange={(e) =>
                    atualizarCampo(
                      'telefone',
                      formatarTelefone(e.target.value)
                    )
                  }
                  placeholder="(11) 3333-3333"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </label>

              <label className="cadastro-campo">
                Celular *

                <input
                  type="tel"
                  value={formulario.celular ?? ''}
                  onChange={(e) =>
                    atualizarCampo(
                      'celular',
                      formatarTelefone(e.target.value)
                    )
                  }
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </label>

              <label className="cadastro-campo cadastro-campo-completo">
                <span className="cadastro-label-com-icone">
                  <Mail size={15} />
                  E-mail *
                </span>

                <input
                  type="email"
                  value={formulario.email ?? ''}
                  onChange={(e) =>
                    atualizarCampo('email', e.target.value)
                  }
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  required
                />
              </label>

            </div>
          </section>

          {/* DADOS ENEL */}

          {pagamentoEnergia && (
            <section className="cadastro-bloco">
              <div className="cadastro-bloco-titulo">
                <Zap size={21} />

                <div>
                  <h2>Dados da conta de energia ENEL</h2>

                  <p>
                    Informe os dados que aparecem na sua conta de energia.
                  </p>
                </div>
              </div>

              <div className="cadastro-grid">

                <label className="cadastro-campo">
                  Número de instalação *

                  <input
                    type="text"
                    value={formulario.numeroInstalacao ?? ''}
                    onChange={(e) =>
                      atualizarCampo(
                        'numeroInstalacao',
                        somenteNumeros(e.target.value).slice(0, 30)
                      )
                    }
                    placeholder="Digite o número de instalação"
                    inputMode="numeric"
                    required
                  />
                </label>

                <label className="cadastro-campo">
                  Número do cliente *

                  <input
                    type="text"
                    value={formulario.numeroClienteEnel ?? ''}
                    onChange={(e) =>
                      atualizarCampo(
                        'numeroClienteEnel',
                        somenteNumeros(e.target.value).slice(0, 30)
                      )
                    }
                    placeholder="Digite o número do cliente"
                    inputMode="numeric"
                    required
                  />
                </label>

                <div className="cadastro-campo cadastro-campo-completo">
                  <span>Titular da conta de energia</span>

                  <strong>
                    {textoSeguro(formulario.nome) ||
                      'O nome informado nos dados pessoais aparecerá aqui.'}
                  </strong>

                  <small>
                    O titular da conta de energia deverá ser o mesmo
                    titular informado no cadastro.
                  </small>
                </div>

              </div>
            </section>
          )}

          {/* RESUMO DA CONTRATAÇÃO */}

          <section className="cadastro-bloco">
            <div className="cadastro-bloco-titulo">
              <ClipboardList size={21} />

              <div>
                <h2>Resumo da contratação</h2>
                <p>Confira suas escolhas.</p>
              </div>
            </div>

            <div className="cadastro-resumo-detalhes">

              <div>
                <span>Plano selecionado</span>

                <strong>
                  {dados.plano?.toUpperCase() || 'Não selecionado'}
                </strong>
              </div>

              <div>
                <span>Forma de pagamento</span>

                <strong>
                  {dados.pagamento === 'cartao'
                    ? 'Checkout de pagamento'
                    : dados.pagamento === 'energia'
                      ? 'Conta de energia - ENEL'
                      : 'Não selecionado'}
                </strong>
              </div>

            </div>
          </section>

          {/* PRIVACIDADE */}

          <section className="cadastro-privacidade">
            <label>
              <input
                type="checkbox"
                checked={aceitouPrivacidade}
                onChange={(e) =>
                  setAceitouPrivacidade(e.target.checked)
                }
              />

              <span>
                Autorizo o tratamento dos meus dados pessoais
                para realizar meu cadastro, processar minha
                contratação e permitir o atendimento pela equipe
                do Doutor de Todos, conforme o aviso de privacidade.
              </span>
            </label>
          </section>

          {/* ERRO */}

          {erro && (
            <div className="cadastro-erro" role="alert">
              <AlertCircle size={19} />
              <span>{erro}</span>
            </div>
          )}

          {/* BOTÕES */}

          <div className="cadastro-acoes">

            {onVoltar && (
              <button
                type="button"
                className="cadastro-botao-voltar"
                onClick={onVoltar}
                disabled={carregando}
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
            )}

            <button
              type="submit"
              className="cadastro-botao-continuar"
              disabled={carregando}
            >
              {carregando ? (
                <>
                  <LoaderCircle size={19} />
                  REGISTRANDO CADASTRO...
                </>
              ) : (
                <>
                  {pagamentoEnergia
                    ? 'CONCLUIR CADASTRO'
                    : 'CONTINUAR PARA PAGAMENTO'}

                  <ArrowRight size={19} />
                </>
              )}
            </button>

          </div>

          <div className="cadastro-seguranca">
            <LockKeyhole size={17} />

            <span>
              Seus dados são enviados ao nosso sistema por conexão segura.
            </span>
          </div>

        </form>
      </div>
    </main>
  );
}
