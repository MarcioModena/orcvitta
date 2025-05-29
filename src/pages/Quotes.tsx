import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, Check, X, Calculator, Search, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import templateImage from '../assets/images/orcamento.jpeg';

interface Quote {
  id: string;
  client: {
    name: string;
    guardian?: string | null;
    cpf?: string | null;
    phone?: string | null;
  };
  created_by: {
    full_name: string;
  };
  status: string;
  payment_methods: PaymentMethod[];
  notes: string;
  created_at: string;
  items: QuoteItem[];
}

interface Client {
  id: string;
  name: string;
  guardian: string | null;
  cpf: string | null;
  phone: string | null;
}

interface Vaccine {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface QuoteItem {
  vaccine_id: string;
  quantity: number;
  price: number;
  vaccine?: {
    name: string;
  };
}

interface PaymentMethod {
  method: string;
  discount: number;
}

const PAYMENT_METHODS = {
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  pix: 'PIX',
  bank_slip: 'Boleto',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export default function Quotes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentSimulation, setShowPaymentSimulation] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [formData, setFormData] = useState({
    client_id: '',
    payment_methods: [] as PaymentMethod[],
    notes: '',
    items: [] as QuoteItem[],
  });

  useEffect(() => {
    fetchQuotes();
    fetchClients();
    fetchVaccines();
  }, []);

  useEffect(() => {
    if (clientSearch) {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (client.cpf && client.cpf.includes(clientSearch))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [clientSearch, clients]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  async function generateAndSendPDF(quote: Quote) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.text('Orçamento', pageWidth / 2, 20, { align: 'center' });
    
    // Client Info
    doc.setFontSize(12);
    doc.text(`Cliente: ${quote.client.name}`, 20, 40);
    if (quote.client.guardian) {
      doc.text(`Responsável: ${quote.client.guardian}`, 20, 50);
    }
    doc.text(`Data: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`, 20, 60);
    
    // Payment Methods
    let y = 70;
    doc.text('Formas de Pagamento:', 20, y);
    y += 10;
    quote.payment_methods.forEach(pm => {
      doc.text(`${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${pm.discount}% de desconto`, 30, y);
      y += 10;
    });
    
    // Items Table
    y += 10;
    doc.text('Vacina', 20, y);
    doc.text('Qtd', 120, y);
    doc.text('Preço', 160, y);
    
    y += 10;
    quote.items.forEach(item => {
      doc.text(item.vaccine?.name || '', 20, y);
      doc.text(item.quantity.toString(), 120, y);
      doc.text(formatCurrency(item.price), 160, y);
      y += 10;
    });
    
    // Subtotal and Payment Options
    const subtotal = quote.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    y += 10;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 120, y);
    
    y += 20;
    doc.text('Valores por forma de pagamento:', 20, y);
    y += 10;
    quote.payment_methods.forEach(pm => {
      const discount = (subtotal * pm.discount) / 100;
      const total = subtotal - discount;
      doc.text(
        `${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${formatCurrency(total)} (${pm.discount}% de desconto)`,
        30,
        y
      );
      y += 10;
    });
    
    // Notes
    if (quote.notes) {
      y += 20;
      doc.text('Observações:', 20, y);
      y += 10;
      doc.text(quote.notes, 20, y);
    }
    
    // Generate blob and create URL
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }

  async function handleWhatsAppShare(quote: Quote) {
    if (!quote.client.phone) {
      alert('Este cliente não possui número de telefone cadastrado.');
      return;
    }

    try {
      // Gerar o PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Adicionar a imagem de fundo
      doc.addImage(templateImage, 'JPEG', 0, 0, pageWidth, pageHeight);
      
      // Configurar fonte e cor padrão
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      
      // Definir área de conteúdo
      const contentArea = {
        left: 35,
        top: 135,
        right: pageWidth - 35,
        bottom: 280
      };
      
      let y = contentArea.top;
      const lineHeight = 5;
      
      // Client Info
      doc.text(`Cliente: ${quote.client.name}`, contentArea.left, y);
      y += lineHeight + 2;
      doc.text(`Data: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`, contentArea.left, y);
      
      // Payment Methods
      y += lineHeight + 2;
      doc.text('Formas de Pagamento:', contentArea.left, y);
      y += lineHeight;
      quote.payment_methods.forEach(pm => {
        doc.text(`${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${pm.discount}% de desconto`, contentArea.left + 5, y);
        y += lineHeight;
      });
      
      // Tabela de Vacinas
      y += lineHeight;
      
      // Configurações da tabela
      const tableConfig = {
        startY: y,
        startX: contentArea.left,
        width: contentArea.right - contentArea.left,
        rowHeight: 8,
        headerHeight: 10,
        fontSize: 9,
        colSpacing: 5
      };
      
      // Desenhar cabeçalho da tabela com estilo mais profissional
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(220, 220, 220);
      doc.rect(tableConfig.startX, tableConfig.startY, tableConfig.width, tableConfig.headerHeight, 'FD');
      
      // Definir colunas com espaçamento otimizado
      const colVacina = tableConfig.startX + 5;
      const colQtd = tableConfig.startX + tableConfig.width - 80;
      const colPreco = tableConfig.startX + tableConfig.width - 55;
      const colSubtotal = tableConfig.startX + tableConfig.width - 25;
      
      // Cabeçalho com fonte em negrito e alinhamento
      doc.setFont('helvetica', 'bold');
      doc.text('Vacina', colVacina, tableConfig.startY + 7);
      doc.text('Qtd', colQtd, tableConfig.startY + 7, { align: 'center' });
      doc.text('Preço Unit.', colPreco, tableConfig.startY + 7, { align: 'right' });
      doc.text('Subtotal', colSubtotal, tableConfig.startY + 7, { align: 'right' });
      
      // Linha separadora após o cabeçalho
      doc.setDrawColor(200, 200, 200);
      doc.line(
        tableConfig.startX,
        tableConfig.startY + tableConfig.headerHeight,
        tableConfig.startX + tableConfig.width,
        tableConfig.startY + tableConfig.headerHeight
      );
      
      // Conteúdo da tabela
      doc.setFont('helvetica', 'normal');
      let currentY = tableConfig.startY + tableConfig.headerHeight;
      
      quote.items.forEach((item, index) => {
        // Alternar cor de fundo das linhas com tons mais suaves
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(tableConfig.startX, currentY, tableConfig.width, tableConfig.rowHeight, 'F');
        }
        
        // Calcular subtotal do item
        const itemSubtotal = item.quantity * item.price;
        
        // Conteúdo com alinhamento apropriado
        doc.text(item.vaccine?.name || '', colVacina, currentY + 6);
        doc.text(item.quantity.toString(), colQtd, currentY + 6, { align: 'center' });
        doc.text(formatCurrency(item.price), colPreco, currentY + 6, { align: 'right' });
        doc.text(formatCurrency(itemSubtotal), colSubtotal, currentY + 6, { align: 'right' });
        
        // Linha separadora entre itens
        doc.setDrawColor(230, 230, 230);
        doc.line(
          tableConfig.startX,
          currentY + tableConfig.rowHeight,
          tableConfig.startX + tableConfig.width,
          currentY + tableConfig.rowHeight
        );
        
        currentY += tableConfig.rowHeight;
      });
      
      // Linha separadora após a tabela
      doc.setDrawColor(200, 200, 200);
      doc.line(
        tableConfig.startX,
        currentY,
        tableConfig.startX + tableConfig.width,
        currentY
      );
      
      // Subtotal com destaque
      y = currentY + lineHeight;
      const subtotal = quote.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subtotal: ${formatCurrency(subtotal)}`, colSubtotal, y, { align: 'right' });
      
      // Valores por forma de pagamento
      y += lineHeight + 2;
      doc.setFont('helvetica', 'normal');
      doc.text('Valores por forma de pagamento:', contentArea.left, y);
      y += lineHeight;
      quote.payment_methods.forEach(pm => {
        const discount = (subtotal * pm.discount) / 100;
        const total = subtotal - discount;
        doc.text(
          `${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${formatCurrency(total)} (${pm.discount}% de desconto)`,
          contentArea.left + 5,
          y
        );
        y += lineHeight;
      });
      
      // Notes
      if (quote.notes && y < contentArea.bottom - 10) {
        y += lineHeight;
        doc.setFont('helvetica', 'bold');
        doc.text('Observações:', contentArea.left, y);
        y += lineHeight;
        doc.setFont('helvetica', 'normal');
        doc.text(quote.notes, contentArea.left + 5, y);
      }

      // Gerar o blob do PDF
      const pdfBlob = doc.output('blob');
      const fileName = `orcamento-${quote.id}-${Date.now()}.pdf`;

      console.log('Iniciando upload do PDF...');
      
      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('quotes')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      console.log('Upload concluído, gerando URL pública...');

      // Gerar URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('quotes')
        .getPublicUrl(fileName);

      console.log('URL pública gerada:', publicUrl);

      // Criar mensagem personalizada
      let message = `Olá ${quote.client.name}! 😊\n\n`;
      message += `Segue o orçamento solicitado:\n\n`;
      
      // Items
      message += `*Vacinas:*\n`;
      quote.items.forEach(item => {
        message += `• ${item.vaccine?.name}\n`;
        message += `  ${item.quantity}x ${formatCurrency(item.price)} = ${formatCurrency(item.quantity * item.price)}\n`;
      });
      
      message += `\n*Subtotal: ${formatCurrency(subtotal)}*\n\n`;
      
      // Payment Methods
      message += `*Formas de Pagamento:*\n`;
      quote.payment_methods.forEach(pm => {
        const total = subtotal - (subtotal * pm.discount / 100);
        message += `• ${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}\n`;
        message += `  ${formatCurrency(total)} ${pm.discount > 0 ? `(${pm.discount}% de desconto)` : ''}\n`;
      });
      
      if (quote.notes) {
        message += `\n*Observações:*\n${quote.notes}\n`;
      }
      
      message += `\nAgradecemos a preferência! Para mais informações ou para agendar a vacinação, estamos à disposição.`;
      message += `\n\n*Link para download do orçamento em PDF:*\n${publicUrl}`;

      // Abrir WhatsApp com a mensagem
      const phoneNumber = quote.client.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

    } catch (error: any) {
      console.error('Erro detalhado:', error);
      alert(`Erro ao gerar ou enviar o PDF: ${error.message || 'Erro desconhecido'}`);
    }
  }

  async function fetchQuotes() {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          client:client_id(name, guardian, cpf, phone),
          created_by(full_name),
          status,
          payment_methods,
          notes,
          created_at,
          items:quote_items(
            quantity,
            price,
            vaccine:vaccine_id(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, guardian, cpf, phone')
      .order('name');
    setClients(data || []);
    setFilteredClients(data || []);
  }

  async function fetchVaccines() {
    const { data } = await supabase
      .from('vaccines')
      .select('id, name, price, stock')
      .order('name');
    setVaccines(data || []);
  }

  async function checkUserProfile() {
    if (!user?.id) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error checking profile:', profileError);
      return null;
    }

    return profile;
  }

  function handleEdit(quote: Quote) {
    const client = clients.find(c => c.name === quote.client.name);
    if (!client) return;

    setEditingQuote(quote);
    setFormData({
      client_id: client.id,
      payment_methods: quote.payment_methods,
      notes: quote.notes,
      items: quote.items.map(item => ({
        vaccine_id: item.vaccine_id,
        quantity: item.quantity,
        price: item.price,
      })),
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user?.id) {
      setError('Você precisa estar autenticado para criar orçamentos.');
      return;
    }

    if (formData.payment_methods.length === 0) {
      setError('Selecione pelo menos uma forma de pagamento.');
      return;
    }

    try {
      const profile = await checkUserProfile();

      if (!profile) {
        setError('Seu perfil não foi encontrado. Por favor, atualize seu perfil para criar orçamentos.');
        setTimeout(() => {
          setIsModalOpen(false);
          navigate('/profile');
        }, 3000);
        return;
      }

      if (editingQuote) {
        // Update existing quote
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            client_id: formData.client_id,
            payment_methods: formData.payment_methods,
            notes: formData.notes,
          })
          .eq('id', editingQuote.id);

        if (quoteError) throw quoteError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', editingQuote.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const quoteItems = formData.items.map(item => ({
          ...item,
          quote_id: editingQuote.id
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) throw itemsError;
      } else {
        // Create new quote
        const quoteData = {
          client_id: formData.client_id,
          payment_methods: formData.payment_methods,
          notes: formData.notes,
          created_by: user.id,
          status: 'pending'
        };

        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();

        if (quoteError) throw quoteError;

        const quoteItems = formData.items.map(item => ({
          ...item,
          quote_id: quote.id
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) throw itemsError;
      }
      
      setIsModalOpen(false);
      setEditingQuote(null);
      setFormData({
        client_id: '',
        payment_methods: [],
        notes: '',
        items: [],
      });
      fetchQuotes();
    } catch (error: any) {
      console.error('Error saving quote:', error);
      setError(error.message || 'Erro ao salvar orçamento. Por favor, tente novamente.');
    }
  }

  async function handleStatusChange(quoteId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;
      fetchQuotes();
    } catch (error) {
      console.error('Error updating quote status:', error);
    }
  }

  function generatePDF(quote: Quote) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Adicionar a imagem de fundo
    doc.addImage(templateImage, 'JPEG', 0, 0, pageWidth, pageHeight);
    
    // Configurar fonte e cor padrão
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    // Definir área de conteúdo (área azul do template)
    const contentArea = {
      left: 20,
      top: 135, // margem ainda maior
      right: pageWidth - 20,
      bottom: 270
    };
    
    // --- PRIMEIRA CAIXA: Cliente, Data, Formas de Pagamento ---
    // Ajustar altura do retângulo conforme a quantidade de linhas (nome, responsável, data)
    const hasGuardian = !!quote.client.guardian;
    const baseInfoBoxHeight = hasGuardian ? 26 : 18;
    const infoBox1 = {
      x: contentArea.left,
      y: contentArea.top,
      w: contentArea.right - contentArea.left,
      h: baseInfoBoxHeight + (quote.payment_methods.length * 6)
    };
    doc.setDrawColor(168, 199, 250);
    doc.setFillColor(168, 199, 250);
    doc.setLineWidth(1);
    doc.roundedRect(infoBox1.x, infoBox1.y, infoBox1.w, infoBox1.h, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    // Centralizar verticalmente o conteúdo da caixa
    const boxContentHeight = hasGuardian ? 16 : 10;
    const boxContentStartY = infoBox1.y + 7;
    doc.text('Nome:', infoBox1.x + 5, boxContentStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(capitalizeName(quote.client.name), infoBox1.x + 25, boxContentStartY);
    if (hasGuardian) {
      doc.setFont('helvetica', 'bold');
      doc.text('Responsável:', infoBox1.x + 5, boxContentStartY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(capitalizeName(quote.client.guardian), infoBox1.x + 30, boxContentStartY + 6);
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', infoBox1.x + infoBox1.w - 45, boxContentStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(quote.created_at).toLocaleDateString('pt-BR'), infoBox1.x + infoBox1.w - 28, boxContentStartY);
    doc.setFont('helvetica', 'bold');
    let pmStartY = boxContentStartY + (hasGuardian ? 12 : 7);
    doc.text('Formas de Pagamento:', infoBox1.x + 5, pmStartY);
    doc.setFont('helvetica', 'normal');
    let pmY = pmStartY;
    quote.payment_methods.forEach(pm => {
      pmY += 6;
      doc.text(`${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${pm.discount}% de desconto`, infoBox1.x + 15, pmY);
    });
    
    // --- TABELA DE VACINAS ---
    const tableY = infoBox1.y + infoBox1.h + 3;
    const tableX = contentArea.left;
    const tableW = contentArea.right - contentArea.left;
    const rowH = 8;
    const headerH = 9;
    const colVacina = tableX + 2;
    const colQtd = tableX + 90;
    const colValor = tableX + tableW - 30;
    
    // Cabeçalho
    doc.setFillColor(230, 240, 255);
    doc.setDrawColor(180, 180, 180);
    doc.rect(tableX, tableY, tableW, headerH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text('VACINA', colVacina, tableY + 6);
    doc.text('QUANTIDADE', colQtd, tableY + 6);
    doc.text('VALOR', colValor, tableY + 6, { align: 'right' });
    
    // Linhas da tabela
    doc.setFont('helvetica', 'normal');
    let currentY = tableY + headerH;
    quote.items.forEach((item, idx) => {
      // Fundo branco
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 200);
      doc.rect(tableX, currentY, tableW, rowH, 'FD');
      // Bordas
      doc.line(tableX, currentY, tableX + tableW, currentY);
      // Conteúdo
      doc.text(item.vaccine?.name || '', colVacina, currentY + 6);
      doc.text(item.quantity.toString(), colQtd, currentY + 6);
      doc.text(formatCurrency(item.price), colValor, currentY + 6, { align: 'right' });
      currentY += rowH;
    });
    // Borda inferior da tabela
    doc.line(tableX, currentY, tableX + tableW, currentY);
    
    // --- SEGUNDA CAIXA: Valores por forma de pagamento e Observações ---
    const box2Y = currentY + 3;
    const box2H = 18 + (quote.payment_methods.length * 6) + (quote.notes ? 10 : 0);
    doc.setDrawColor(168, 199, 250);
    doc.setFillColor(168, 199, 250);
    doc.setLineWidth(1);
    doc.roundedRect(contentArea.left, box2Y, tableW, box2H, 3, 3, 'FD');
    let box2TextY = box2Y + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Valores por forma de pagamento:', contentArea.left + 5, box2TextY);
    doc.setFont('helvetica', 'normal');
    const subtotal = quote.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    let valY = box2TextY;
    quote.payment_methods.forEach(pm => {
      valY += 6;
      const discount = (subtotal * pm.discount) / 100;
      const total = subtotal - discount;
      doc.text(
        `${PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}: ${formatCurrency(total)} (${pm.discount}% de desconto)`,
        contentArea.left + 15,
        valY
      );
    });
    if (quote.notes) {
      valY += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('Observação:', contentArea.left + 5, valY);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.notes, contentArea.left + 25, valY);
    }
    // Subtotal destacado
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${formatCurrency(subtotal)}`, colValor, box2Y + box2H - 4, { align: 'right' });
    
    doc.save(`orcamento-${quote.id}.pdf`);
  }

  function addQuoteItem() {
    setFormData({
      ...formData,
      items: [...formData.items, { vaccine_id: '', quantity: 1, price: 0 }],
    });
  }

  function updateQuoteItem(index: number, field: keyof QuoteItem, value: string | number) {
    const newItems = [...formData.items];
    if (field === 'vaccine_id') {
      const vaccine = vaccines.find(v => v.id === value);
      newItems[index] = {
        ...newItems[index],
        [field]: value,
        price: vaccine?.price || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    setFormData({ ...formData, items: newItems });
  }

  function removeQuoteItem(index: number) {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  }

  function addPaymentMethod() {
    setFormData({
      ...formData,
      payment_methods: [...formData.payment_methods, { method: '', discount: 0 }],
    });
  }

  function updatePaymentMethod(index: number, field: keyof PaymentMethod, value: string | number) {
    const newPaymentMethods = [...formData.payment_methods];
    newPaymentMethods[index] = {
      ...newPaymentMethods[index],
      [field]: value,
    };
    setFormData({ ...formData, payment_methods: newPaymentMethods });
  }

  function removePaymentMethod(index: number) {
    const newPaymentMethods = formData.payment_methods.filter((_, i) => i !== index);
    setFormData({ ...formData, payment_methods: newPaymentMethods });
  }

  function calculateTotal(items: QuoteItem[], discount: number = 0) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return subtotal - (subtotal * discount) / 100;
  }

  // Função para capitalizar as iniciais do nome
  function capitalizeName(name: string) {
    return name.replace(/\b\w/g, (l) => l.toUpperCase());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
        <button
          onClick={() => {
            setEditingQuote(null);
            setFormData({
              client_id: '',
              payment_methods: [],
              notes: '',
              items: [],
            });
            setIsModalOpen(true);
          }}
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Orçamento
        </button>
      </div>

      {/* Quotes Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsável
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Criado por
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {quote.client.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {quote.client.guardian ? quote.client.guardian : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[quote.status as keyof typeof STATUS_COLORS]}`}>
                    {STATUS_LABELS[quote.status as keyof typeof STATUS_LABELS]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {quote.created_by.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleWhatsAppShare(quote)}
                    className="text-green-600 hover:text-green-900 inline-flex items-center"
                    title="Enviar por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => generatePDF(quote)}
                    className="text-primary hover:text-primary/90 inline-flex items-center"
                    title="Baixar PDF"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  {quote.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleEdit(quote)}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(quote.id, 'approved')}
                        className="text-green-600 hover:text-green-900 inline-flex items-center"
                        title="Aprovar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(quote.id, 'rejected')}
                        className="text-red-600 hover:text-red-900 inline-flex items-center"
                        title="Rejeitar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Quote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingQuote ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingQuote(null);
                }}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
                title="Cancelar"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client Selection with Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm mb-2"
                  />
                </div>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                  disabled={!!editingQuote}
                >
                  <option value="">Selecione um cliente</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.cpf ? `(CPF: ${client.cpf})` : ''} {client.guardian ? `(Responsável: ${client.guardian})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Itens do Orçamento */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Itens do Orçamento</h3>
                  <button
                    type="button"
                    onClick={addQuoteItem}
                    className="text-primary hover:text-primary/90 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg">
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vacina</label>
                      <select
                        required
                        value={item.vaccine_id}
                        onChange={(e) => updateQuoteItem(index, 'vaccine_id', e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      >
                        <option value="">Selecione uma vacina</option>
                        {vaccines.map((vaccine) => (
                          <option key={vaccine.id} value={vaccine.id}>
                            {vaccine.name} - {formatCurrency(vaccine.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuoteItem(index, 'quantity', parseInt(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preço</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateQuoteItem(index, 'price', parseFloat(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeQuoteItem(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {formData.items.length > 0 && (
                  <div className="text-right text-lg font-medium">
                    Subtotal: {formatCurrency(calculateTotal(formData.items))}
                  </div>
                )}
              </div>

              {/* Formas de Pagamento */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Formas de Pagamento</h3>
                  <button
                    type="button"
                    onClick={addPaymentMethod}
                    className="text-primary hover:text-primary/90 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Forma de Pagamento
                  </button>
                </div>
                {formData.payment_methods.map((pm, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg">
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                      <select
                        required
                        value={pm.method}
                        onChange={(e) => updatePaymentMethod(index, 'method', e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      >
                        <option value="">Selecione o método</option>
                        {Object.entries(PAYMENT_METHODS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (%)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={pm.discount}
                        onChange={(e) => updatePaymentMethod(index, 'discount', parseFloat(e.target.value))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removePaymentMethod(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Simulação de Valores */}
                {formData.payment_methods.length > 0 && formData.items.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium">Simulação de Valores</h4>
                      <button
                        type="button"
                        onClick={() => setShowPaymentSimulation(!showPaymentSimulation)}
                        className="text-primary hover:text-primary/90 flex items-center"
                      >
                        <Calculator className="w-4 h-4 mr-1" />
                        {showPaymentSimulation ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showPaymentSimulation && (
                      <div className="space-y-2">
                        {formData.payment_methods.map((pm, index) => {
                          const total = calculateTotal(formData.items, pm.discount);
                          return (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span>{PAYMENT_METHODS[pm.method as keyof typeof PAYMENT_METHODS]}:</span>
                              <span className="font-medium">
                                {formatCurrency(total)}
                                {pm.discount > 0 && ` (${pm.discount}% de desconto)`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>

              <button type="submit" className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90">
                {editingQuote ? 'Salvar' : 'Criar Orçamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}