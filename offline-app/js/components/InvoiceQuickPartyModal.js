// components/InvoiceQuickPartyModal.js
(function (global) {
  'use strict';

  const InvoiceQuickPartyModal = {
    components: {
      PartyModalComponent: global.PartyModalComponent
    },
    props: {
      show: { type: Boolean, default: false },
      editingParty: { type: Object, default: null },
      initialName: { type: String, default: '' },
      mode: { type: String, default: 'sales' }
    },
    emits: ['close', 'save'],
    template: `
      <party-modal-component
        :show="show"
        :editing-party="editingParty"
        :party-to-edit="editingParty"
        :initial-name="initialName"
        :default-type="mode === 'purchase' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS'"
        :mode="mode"
        @close="$emit('close')"
        @save="$emit('save', $event)"
      ></party-modal-component>
    `
  };

  global.InvoiceQuickPartyModal = InvoiceQuickPartyModal;
})(window);
