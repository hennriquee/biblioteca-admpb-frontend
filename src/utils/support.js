/**
 * Dados do menu "Participe" do acervo publico (components/CatalogMenu.jsx).
 * Trocou a chave PIX ou o grupo? Mude so aqui.
 */

// PIX "copia e cola" (sem valor fixo: quem doa escolhe quanto). O QR code da
// tela e gerado a partir deste mesmo texto (components/PixQr.jsx), entao os
// dois nunca ficam diferentes. Os 4 ultimos caracteres sao o digito
// verificador (CRC16): um texto editado na mao deixa de valer no banco.
export const PIX_CODE =
  "00020126580014BR.GOV.BCB.PIX013650d729d9-bb45-412e-8f9d-de9ce913a1b65204000053039865802BR5925Bruno Henrique Martins da6009SAO PAULO62140510rhZ7u6U74q63045CF0";

// Nome de quem recebe, como aparece no app do banco na hora de pagar.
export const PIX_RECEIVER = "Bruno Henrique Martins";

// Link de cobranca do Nubank: para quem prefere pagar pelo navegador.
export const PIX_LINK =
  "https://nubank.com.br/cobrar/9bor9/6ad97042-e123-465e-93d5-b2df25e4f209";

// Convite do grupo de novidades no WhatsApp.
export const WHATSAPP_GROUP =
  "https://chat.whatsapp.com/FVmlY79t5uzAlc8lEfqkrf?s=cl&p=a&iam=2";

// WhatsApp da biblioteca para falar com a equipe: o numero CANADENSE
// (+1 365 796 3315, desde 13/11/2026; antes era o argentino +54 9 11
// 6461-0665), o mesmo ligado ao painel (Conversas). Ninguem responde
// sozinho: quem responde e um administrador, pelo painel. Usado no botao
// flutuante do /catalogo e no "Precisa de algo a mais?" do menu Participe.
// Nao confundir com LIBRARY_WHATSAPP (utils/whatsapp.js), o numero
// BRASILEIRO de reserva do "Solicitar empréstimo".
export const LIBRARY_CONTACT_WHATSAPP = "13657963315";

export const LIBRARY_CONTACT_URL =
  "https://wa.me/" +
  LIBRARY_CONTACT_WHATSAPP +
  "?text=" +
  encodeURIComponent("Olá!");
