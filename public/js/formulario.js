import { $, criar, avisar } from './util.js';
import { api } from './api.js';
import { estado } from './estado.js';
import { RECURSOS } from './recursos.js';
import { urlImagem } from './componentes.js';
import { carregarLista, carregarColecoes } from './cadastros.js';

const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const TAMANHO_MAX_ORIGINAL = 20 * 1024 * 1024;
const TAMANHO_MAX_ENVIO = 5 * 1024 * 1024;
const LADO_MAX_IMAGEM = 1000;

let editandoId = null;
let imagemForm = { arquivo: null, remover: false };

export function abrirFormulario(item = null) {
  const recurso = RECURSOS[estado.aba];
  editandoId = item?.id ?? null;
  $('#titulo-form').textContent = `${item ? 'Editar' : 'Cadastrar'} ${recurso.singular}`;
  $('#erro-form').textContent = '';

  $('#campos-form').replaceChildren(
    ...recurso.campos.map((campo) => {
      let entrada;
      if (campo.opcoes) {
        entrada = criar('select', { name: campo.nome }, [
          criar('option', { value: '', textContent: 'Selecione...' }),
          ...campo.opcoes().map((op) => {
            const [valor, texto] = Array.isArray(op) ? op : [op, op];
            return criar('option', { value: valor, textContent: texto });
          }),
        ]);
      } else {
        entrada = criar('input', { name: campo.nome, type: campo.tipo ?? 'text' });
        if (campo.passo) Object.assign(entrada, { step: campo.passo, min: 0 });
        if (campo.tipo === 'password') entrada.autocomplete = 'new-password';
      }
      const obrigatorio = Boolean(campo.obrigatorio || (campo.obrigatorioCriar && !item));
      entrada.required = obrigatorio;
      entrada.value = campo.valor ? campo.valor(item) : item?.[campo.nome] ?? (campo.tipo === 'number' ? 0 : '');
      const rotulo = (item && campo.rotuloEdicao) || campo.rotulo;
      return criar('label', { className: campo.largo ? 'largo' : '' }, [`${rotulo}${obrigatorio ? ' *' : ''}`, entrada]);
    })
  );
  if (recurso.imagem) $('#campos-form').append(campoImagem(item));
  $('#modal').showModal();
}

async function reduzirImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAX_IMAGEM / Math.max(bitmap.width, bitmap.height));
  const canvas = criar('canvas', { width: Math.round(bitmap.width * escala), height: Math.round(bitmap.height * escala) });
  const contexto = canvas.getContext('2d');
  const gerar = (tipo) => new Promise((ok) => canvas.toBlob(ok, tipo, 0.85));

  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let reduzida = await gerar('image/webp');
  if (!reduzida || reduzida.type !== 'image/webp') {
    contexto.globalCompositeOperation = 'destination-over';
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    reduzida = await gerar('image/jpeg');
  }
  bitmap.close();
  return escala === 1 && arquivo.size <= reduzida.size ? arquivo : reduzida;
}

function campoImagem(item) {
  imagemForm = { arquivo: null, remover: false };
  const previa = criar('img', { className: 'previa-imagem', alt: 'Pré-visualização' });
  const vazio = criar('span', { className: 'previa-vazia', textContent: 'Sem imagem' });
  const entrada = criar('input', { type: 'file', accept: TIPOS_IMAGEM.join(',') });
  const remover = criar('button', { type: 'button', className: 'mini perigo', textContent: 'Remover imagem' });
  const info = criar('small', { className: 'info-imagem' });

  const mostrar = (url) => {
    previa.hidden = !url;
    vazio.hidden = Boolean(url);
    remover.hidden = !url;
    if (url) previa.src = url;
  };

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files[0];
    $('#erro-form').textContent = '';
    info.textContent = '';
    if (!arquivo) return;
    const falhar = (mensagem) => {
      entrada.value = '';
      $('#erro-form').textContent = mensagem;
    };
    if (!TIPOS_IMAGEM.includes(arquivo.type)) return falhar('Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF.');
    if (arquivo.size > TAMANHO_MAX_ORIGINAL) return falhar('Imagem muito grande. O tamanho máximo é 20 MB.');
    try {
      info.textContent = 'Otimizando imagem...';
      const reduzida = await reduzirImagem(arquivo);
      if (reduzida.size > TAMANHO_MAX_ENVIO) return falhar('Mesmo reduzida, a imagem passou de 5 MB. Tente outra foto.');
      imagemForm = { arquivo: reduzida, remover: false };
      mostrar(URL.createObjectURL(reduzida));
      const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
      info.textContent = reduzida === arquivo ? kb(arquivo.size) : `${kb(arquivo.size)} → ${kb(reduzida.size)}`;
    } catch {
      info.textContent = '';
      falhar('Não foi possível ler essa imagem.');
    }
  });

  remover.addEventListener('click', () => {
    imagemForm = { arquivo: null, remover: Boolean(item?.imagem) };
    entrada.value = '';
    info.textContent = '';
    mostrar(null);
  });

  mostrar(urlImagem(item));
  return criar('div', { className: 'campo-imagem largo' }, [
    criar('div', { className: 'moldura-previa' }, [previa, vazio]),
    criar('div', { className: 'controles-imagem' }, [
      criar('label', {}, ['Imagem (PNG, JPG, WEBP ou GIF), reduzida automaticamente', entrada]),
      info,
      remover,
    ]),
  ]);
}

async function salvarImagem(id) {
  if (imagemForm.arquivo) {
    await api(`${estado.aba}/${id}/imagem`, { method: 'PUT', body: imagemForm.arquivo });
  } else if (imagemForm.remover) {
    await api(`${estado.aba}/${id}/imagem`, { method: 'DELETE' });
  }
}

export function iniciarFormulario() {
  $('#btn-cancelar').addEventListener('click', () => $('#modal').close());
  $('#form').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.target));
    const recurso = RECURSOS[estado.aba];
    try {
      if (editandoId) {
        await api(`${estado.aba}/${editandoId}`, { method: 'PUT', body: dados });
      } else {
        editandoId = (await api(estado.aba, { method: 'POST', body: dados })).id;
      }
      if (recurso.imagem) await salvarImagem(editandoId);
      avisar('Registro salvo.');
      $('#modal').close();
      if (recurso.porColecao || estado.aba === 'colecoes') await carregarColecoes();
      await carregarLista();
    } catch (erro) {
      $('#erro-form').textContent = erro.message;
      carregarLista().catch(() => {});
    }
  });
}
