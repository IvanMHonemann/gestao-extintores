import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, MessageCircle } from "lucide-react";

interface ServiceOrderDocumentProps {
  order: any;
  client: any;
  items: any[];
  onBack?: () => void;
}

export function ServiceOrderDocument({
  order,
  client,
  items = [],
  onBack,
}: ServiceOrderDocumentProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const orderLabel = order?.orderNumber ? `OS nº ${String(order.orderNumber).padStart(5, "0")}` : "Ordem de Serviço";
    const shareUrl = window.location.href;
    const message = `${orderLabel} — documento pronto para visualizar e salvar em PDF: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  // Formata data YYYY-MM-DD para DD / MM / AAAA
  const formatDateBR = (dateStr?: string | Date | null) => {
    if (!dateStr) return "__ / __ / ____";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.toString();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day} / ${month} / ${year}`;
  };

  // Preencher até pelo menos 7 linhas de serviços prestados para bater com o layout original
  const rowsNeeded = Math.max(7, items.length);
  const displayItems = [...items];
  while (displayItems.length < rowsNeeded) {
    displayItems.push({
      id: `empty-${displayItems.length}`,
      description: "",
      quantity: "",
      unitPrice: "",
      totalPrice: "",
    });
  }

  const isReplacedYes = order?.replacedAndDelivered?.toUpperCase() === "SIM";
  const isReplacedNo = order?.replacedAndDelivered?.toUpperCase() === "NÃO";
  const isReserveYes = order?.leftReserve?.toUpperCase() === "SIM";
  const isReserveNo = order?.leftReserve?.toUpperCase() === "NÃO";

  const isAVista = order?.paymentMethod?.toUpperCase().includes("VISTA");
  const isParcelado = order?.paymentMethod?.toUpperCase().includes("PARCELADO");
  const isBoleto = order?.paymentMethod?.toUpperCase().includes("BOLETO");

  return (
    <div className="flex flex-col items-center py-3 sm:py-6 px-2 sm:px-4 bg-slate-100 min-h-screen overflow-x-hidden">
      {/* Barra de Ações Superior (Oculta na Impressão) */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 sm:mb-6 px-1 sm:px-4 print:hidden">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={handleShareWhatsApp}
            variant="outline"
            className="border-green-600 text-green-700 hover:bg-green-50 gap-2 font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            Compartilhar PDF no WhatsApp
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-red-700 hover:bg-red-800 text-white gap-2 font-semibold shadow-md"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar em PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO IMPRESSO (Página A4 Exata) */}
      <div
        ref={componentRef}
        className="w-[calc(100vw-16px)] sm:w-[210mm] max-w-[210mm] min-h-0 sm:min-h-[297mm] bg-white p-3 sm:p-[10mm] text-slate-900 shadow-xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:w-full print:m-0 flex flex-col justify-between"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div>
          {/* CABEÇALHO */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 sm:w-16 h-12 sm:h-18 flex items-center justify-center">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-red-700 text-white flex items-center justify-center text-xl sm:text-2xl font-black">
                  ✓
                </div>
              </div>
              <div className="border-l-2 border-slate-700 pl-3">
                <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                  CONTROLE DE EXTINTORES
                </h1>
                <p className="text-xs font-bold tracking-wider text-slate-800 uppercase mt-1">
                  GESTÃO E MANUTENÇÃO
                </p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-sm sm:text-lg font-black tracking-wide text-slate-900">
                ORDEM DE SERVIÇO
              </h2>
              <div className="text-sm font-bold mt-1 text-slate-800">
                Nº: <span className="font-mono text-base">{String(order?.orderNumber || 1001).padStart(5, '0')}</span>
              </div>
              <div className="text-xs font-semibold mt-1">
                DATA: <span className="font-bold underline decoration-slate-400">{formatDateBR(order?.orderDate)}</span>
              </div>
            </div>
          </div>

          {/* DADOS DO CLIENTE */}
          <div className="border-2 border-slate-800 mb-3 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              DADOS DO CLIENTE
            </div>

            <div className="p-2 space-y-1.5 font-medium leading-tight">
              <div className="flex border-b border-slate-300 pb-1">
                <span className="font-bold w-24">EMPRESA:</span>
                <span className="flex-1 font-semibold text-slate-950 uppercase">{client?.companyName || "—"}</span>
              </div>

              <div className="flex border-b border-slate-300 pb-1">
                <span className="font-bold w-24">ENDEREÇO:</span>
                <span className="flex-1 text-slate-900">{client?.address || "—"}</span>
              </div>

              <div className="flex border-b border-slate-300 pb-1">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CIDADE:</span>
                  <span className="font-semibold text-slate-950 uppercase">{client?.city || "—"}</span>
                </div>
                <div className="w-48 flex justify-end">
                  <span className="font-bold mr-2">CEP:</span>
                  <span>{client?.cep || "—"}</span>
                </div>
              </div>

              <div className="flex border-b border-slate-300 pb-1">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CNPJ:</span>
                  <span className="font-mono">{client?.cnpj || "—"}</span>
                </div>
                <div className="w-56 flex justify-end">
                  <span className="font-bold mr-2">FONE:</span>
                  <span className="font-mono">{client?.phone || "—"}</span>
                </div>
              </div>

              <div className="flex border-b border-slate-300 pb-1">
                <span className="font-bold w-64">NOME DO PROPRITARIO OU RESPONSAVEL:</span>
                <span className="flex-1 text-slate-950 uppercase font-semibold">
                  {order?.responsibleName || client?.contactName || "—"}
                </span>
              </div>

              <div className="flex">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CPF:</span>
                  <span className="font-mono">{order?.responsibleCpf || client?.cpf || "—"}</span>
                </div>
                <div className="w-64 flex justify-end">
                  <span className="font-bold mr-2">DATA DE NASCIMENTO:</span>
                  <span>{order?.responsibleBirthDate || client?.birthDate || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SERVIÇOS PRESTADOS */}
          <div className="border-2 border-slate-800 mb-3 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              SERVIÇOS PRESTADO
            </div>

            <table className="w-full text-left border-collapse text-[10px] sm:text-xs">
              <thead>
                <tr className="border-b-2 border-slate-800 font-bold bg-slate-100 text-center">
                  <th className="p-1.5 border-r-2 border-slate-800 w-[55%] text-left pl-3">DESCRIÇÃO</th>
                  <th className="p-1.5 border-r-2 border-slate-800 w-[12%]">QTD.</th>
                  <th className="p-1.5 border-r-2 border-slate-800 w-[16%]">VALOR UNID</th>
                  <th className="p-1.5 w-[17%]">VALOR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="border-b border-slate-400 min-h-[24px] text-slate-900"
                    style={{ height: "26px" }}
                  >
                    <td className="p-1.5 border-r-2 border-slate-800 pl-3 font-medium">
                      {item.description}
                    </td>
                    <td className="p-1.5 border-r-2 border-slate-800 text-center font-semibold">
                      {item.quantity}
                    </td>
                    <td className="p-1.5 border-r-2 border-slate-800 text-right pr-2 font-mono">
                      {item.unitPrice ? `R$ ${Number(item.unitPrice).toFixed(2)}` : ""}
                    </td>
                    <td className="p-1.5 text-right pr-2 font-mono font-semibold">
                      {item.totalPrice ? `R$ ${Number(item.totalPrice).toFixed(2)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CAMPOS DE STATUS DA ENTREGA & VENCIMENTOS */}
          <div className="border-2 border-slate-800 mb-3 p-2 text-xs space-y-1.5 font-bold">
            <div className="flex items-center">
              <span className="w-52">TROCADO E ENTREGUE:</span>
              <span className="mr-6">
                (&nbsp;{isReplacedYes ? "X" : "\u00A0\u00A0"}&nbsp;) SIM
              </span>
              <span>
                (&nbsp;{isReplacedNo ? "X" : "\u00A0\u00A0"}&nbsp;) NÃO
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1">
              <span className="w-full sm:w-52">DEIXOU RESERVA:</span>
              <span className="mr-6">
                (&nbsp;{isReserveYes ? "X" : "\u00A0\u00A0"}&nbsp;) SIM
              </span>
              <span className="mr-8">
                (&nbsp;{isReserveNo ? "X" : "\u00A0\u00A0"}&nbsp;) NÃO
              </span>
              <div className="w-full sm:flex-1 flex items-center">
                <span className="mr-2">QUAIS:</span>
                <span className="flex-1 border-b border-slate-700 font-normal px-2">
                  {order?.reserveDetails || ""}
                </span>
              </div>
            </div>

            <div className="flex items-center">
              <span className="w-52">VENCIMENTO DO EXTINTOR:</span>
              <span className="flex-1 border-b border-slate-700 font-semibold px-2 text-red-700">
                {order?.extinguisherExpiration || ""}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-52">VENCIMENTO DO ALVARÁ:</span>
              <span className="flex-1 border-b border-slate-700 font-semibold px-2">
                {order?.licenseExpiration || ""}
              </span>
            </div>
          </div>

          {/* FORMA DE PAGAMENTO */}
          <div className="border-2 border-slate-800 mb-4 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              FORMA DE PAGAMENTO
            </div>

            <div className="p-2 space-y-1.5 font-bold">
              <div className="flex items-center text-sm">
                <span className="w-32">VALOR TOTAL:</span>
                <span className="bg-amber-300 px-2 py-0.5 rounded text-black font-black text-base font-mono">
                  R$ {Number(order?.totalAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center pt-1">
                <span className="w-48">FORMA DE PAGAMENTO:</span>
                <span className="mr-6">
                  (&nbsp;{isAVista ? "X" : "\u00A0\u00A0"}&nbsp;) À VISTA
                </span>
                <span className="mr-6">
                  (&nbsp;{isParcelado ? "X" : "\u00A0\u00A0"}&nbsp;) PARCELADO
                </span>
                <span>
                  (&nbsp;{isBoleto ? "X" : "\u00A0\u00A0"}&nbsp;) BOLETO
                </span>
              </div>

              <div className="flex items-center">
                <span className="w-48">NÚMEROS DE PARCELAS:</span>
                <span className="border-b border-slate-700 font-normal px-2 min-w-[60px]">
                  {order?.installmentsCount || 1}
                </span>
              </div>

              <div className="flex items-center">
                <span className="w-48">DATAS:</span>
                <span className="flex-1 border-b border-slate-700 font-normal px-2">
                  {order?.installmentDates || ""}
                </span>
              </div>
            </div>
          </div>

          {/* ÁREA DE ASSINATURAS */}
          <div className="grid grid-cols-2 gap-8 pt-8 pb-4 text-xs text-center font-bold">
            <div>
              <div className="border-t-2 border-slate-800 pt-1.5 uppercase">
                CONTROLE DE EXTINTORES PREVENÇÃO<br />CONTRA INCÊNDIO
              </div>
            </div>

            <div className="text-left font-mono text-[11px] leading-tight">
              <div className="border-t-2 border-slate-800 pt-1.5 font-bold font-sans">
                PROPRIETARIO OU RESPONSAVEL
              </div>
              <div className="mt-1">
                CPF: <span className="font-normal">{order?.responsibleCpf || client?.cpf || "______________________"}</span>
              </div>
              <div className="mt-0.5">
                DATA NASC: <span className="font-normal">{order?.responsibleBirthDate || client?.birthDate || "____ / ____ / ________"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DA APLICAÇÃO */}
        <div className="border-t-2 border-slate-800 pt-2 text-[9px] sm:text-[10.5px] leading-relaxed text-slate-700 text-center">
          <div className="font-bold text-slate-900">CONTROLE DE EXTINTORES</div>
          <div>Ordem de Serviço • Controle de manutenção e validade</div>
        </div>

      </div>

      {/* ESTILOS DE IMPRESSÃO CSS */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
