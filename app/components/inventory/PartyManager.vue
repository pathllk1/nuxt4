<template>
  <section class="party-panel" ref="partyPanelRef">
    <header class="panel-head">
      <div>
        <p class="eyebrow">Party</p>
        <h2>{{ title }}</h2>
      </div>
      <div class="flex items-center gap-1.5">
        <button v-if="state.selectedParty && !state.isReturnMode" class="link-btn" type="button" title="Edit party (Alt+E)" @click="$emit('edit-party', state.selectedParty)">
          Edit (Alt+E)
        </button>
        <button v-if="!state.isReturnMode" class="link-btn" type="button" @click="$emit('create-party')">
          New (Insert)
        </button>
      </div>
    </header>

    <button v-if="!state.selectedParty" class="empty-party" type="button" @click="$emit('open-modal')">
      <span>Select party</span>
      <small>{{ emptySubtitle }}</small>
    </button>

    <div v-else class="selected-party">
      <div class="party-title-row">
        <div class="min-w-0 flex-1">
          <h3 class="truncate">{{ state.selectedParty.name || state.selectedParty.firm }}</h3>
          <p class="font-mono text-xs font-bold text-slate-500">{{ state.selectedPartyGstin || 'UNREGISTERED' }}</p>
        </div>
        <button v-if="!state.isReturnMode" class="change-btn shrink-0" type="button" title="Change party (F3)" @click="$emit('open-modal')">
          Change (F3)
        </button>
      </div>

      <!-- GST Location Selector for Billing (Bill-To) -->
      <div v-if="state.gstEnabled && state.selectedParty?.gstLocations?.length > 1" class="gst-selector-container">
        <label class="gst-select-label">
          <span>Billing GSTIN / Branch</span>
          <select 
            :value="state.selectedPartyLocation?.gstin || state.selectedPartyGstin || ''" 
            @change="onPartyGstinChange" 
            @keydown.enter.prevent="onInputEnter($event)"
            @keydown.backspace="onInputBackspace($event)"
            class="gst-select"
          >
            <option 
              v-for="loc in state.selectedParty.gstLocations" 
              :key="loc.gstin || loc.stateCode || loc.state" 
              :value="loc.gstin || ''"
            >
              {{ loc.gstin || 'UNREGISTERED' }} - {{ loc.state || loc.stateCode || '' }}{{ loc.isPrimary ? ' (Primary)' : '' }}
            </option>
          </select>
        </label>
      </div>

      <dl class="party-meta">
        <div class="party-meta-row">
          <dt>Closing Balance</dt>
          <dd>
            <span 
              class="closing-bal-val"
              :class="state.selectedParty.closingBalanceType === 'DR' ? 'bal-dr' : (state.selectedParty.closingBalanceType === 'CR' ? 'bal-cr' : 'bal-nil')"
            >
              {{ state.selectedParty.formattedBalance || ('₹' + (Number(state.selectedParty.openingBalance) || 0).toFixed(2) + ' ' + (state.selectedParty.balanceType || 'DR')) }}
            </span>
          </dd>
        </div>
        <div class="party-meta-row">
          <dt>State</dt>
          <dd class="state-val">{{ state.selectedPartyLocation?.state || state.selectedParty.state || '-' }}</dd>
        </div>
        <div class="party-meta-row address-row">
          <dt>Address</dt>
          <dd class="address-val">{{ state.selectedPartyLocation?.address || state.selectedParty.address || '-' }}</dd>
        </div>
      </dl>
    </div>

    <!-- Consignee / Ship-To Section -->
    <div class="consignee-block">
      <label class="same-toggle">
        <input 
          v-model="state.consigneeSameAsBillTo" 
          type="checkbox" 
          @change="handleConsigneeToggle" 
          @keydown.enter.prevent="onInputEnter($event)"
          @keydown.backspace="onInputBackspace($event)"
        />
        <span>Ship to billing address</span>
      </label>

      <!-- Different Consignee / Ship-To View -->
      <div v-if="!state.consigneeSameAsBillTo && state.selectedConsignee" class="ship-fields">
        <!-- Quick Pick from Party Locations if Party has multiple branches -->
        <div v-if="state.selectedParty?.gstLocations?.length > 1" class="party-branch-picker">
          <label class="gst-select-label">
            <span>Ship to Party Branch:</span>
            <select 
              @change="onConsigneeLocationChange" 
              @keydown.enter.prevent="onInputEnter($event)"
              @keydown.backspace="onInputBackspace($event)"
              class="gst-select"
            >
              <option value="">-- Choose Party Location or Custom --</option>
              <option 
                v-for="loc in state.selectedParty.gstLocations" 
                :key="loc.gstin || loc.stateCode || loc.state" 
                :value="loc.gstin || ''"
              >
                {{ loc.gstin || 'Branch' }} - {{ loc.state || '' }} ({{ loc.address ? loc.address.substring(0, 30) + '...' : '' }})
              </option>
            </select>
          </label>
        </div>

        <label>
          <span>Consignee Name *</span>
          <input 
            v-model="state.selectedConsignee.name" 
            type="text" 
            placeholder="Consignee / Company name" 
            @keydown.enter.prevent="onInputEnter($event)"
            @keydown.backspace="onInputBackspace($event)"
          />
        </label>
        <label>
          <span>Address *</span>
          <textarea 
            v-model="state.selectedConsignee.address" 
            rows="2" 
            placeholder="Delivery address"
            @keydown.enter="onTextareaEnter($event)"
            @keydown.backspace="onInputBackspace($event)"
          ></textarea>
        </label>
        <div class="ship-grid">
          <label v-if="state.gstEnabled">
            <span>GSTIN</span>
            <input 
              v-model="state.selectedConsignee.gstin" 
              type="text" 
              maxlength="15" 
              placeholder="27ABCDE1234F1Z5" 
              @keydown.enter.prevent="onInputEnter($event)"
              @keydown.backspace="onInputBackspace($event)"
            />
          </label>
          <label :style="!state.gstEnabled ? 'grid-column: span 2;' : ''">
            <span>State *</span>
            <input 
              v-model="state.selectedConsignee.state" 
              type="text" 
              placeholder="e.g. Maharashtra" 
              @keydown.enter.prevent="onInputEnter($event)"
              @keydown.backspace="onInputBackspace($event)"
            />
          </label>
        </div>
        <div class="ship-grid">
          <label>
            <span>PIN Code</span>
            <input 
              v-model="state.selectedConsignee.pin" 
              type="text" 
              maxlength="6" 
              placeholder="PIN" 
              @keydown.enter.prevent="onInputEnter($event)"
              @keydown.backspace="onInputBackspace($event)"
            />
          </label>
          <label>
            <span>Contact</span>
            <input 
              v-model="state.selectedConsignee.contact" 
              type="text" 
              placeholder="Phone/Contact" 
              @keydown.enter.prevent="onInputEnter($event)"
              @keydown.backspace="onInputBackspace($event)"
            />
          </label>
        </div>
        <label>
          <span>Delivery Instructions</span>
          <input 
            v-model="state.selectedConsignee.deliveryInstructions" 
            type="text" 
            placeholder="Special dispatch instructions"
            @keydown.enter.prevent="onInputEnter($event)"
            @keydown.backspace="onInputBackspace($event)"
          />
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import type { BillingState } from '@/composables/useBillingState';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const props = withDefaults(defineProps<{
  state: BillingState;
  title?: string;
  emptySubtitle?: string;
}>(), {
  title: 'Bill to',
  emptySubtitle: 'Customer or supplier record'
});

const emit = defineEmits(['open-modal', 'create-party', 'edit-party', 'location-change']);
const { handleEnterKey, handleBackspaceKey } = useKeyboardNavigation();
const partyPanelRef = ref<HTMLElement | null>(null);

function onPartyGstinChange(event: Event) {
  const gstin = (event.target as HTMLSelectElement).value;
  const loc = props.state.selectedParty?.gstLocations?.find((l: any) => l.gstin === gstin) || null;
  props.state.selectedPartyLocation = loc;
  props.state.selectedPartyGstin = gstin || 'UNREGISTERED';
  emit('location-change');
}

function onConsigneeLocationChange(event: Event) {
  const gstin = (event.target as HTMLSelectElement).value;
  if (!gstin) return;
  const loc = props.state.selectedParty?.gstLocations?.find((l: any) => l.gstin === gstin);
  if (loc && props.state.selectedConsignee) {
    props.state.selectedConsignee.name = props.state.selectedParty?.name || props.state.selectedParty?.firm || '';
    props.state.selectedConsignee.gstin = loc.gstin || 'UNREGISTERED';
    props.state.selectedConsignee.address = loc.address || '';
    props.state.selectedConsignee.state = loc.state || '';
    props.state.selectedConsignee.stateCode = loc.stateCode || (loc.gstin && loc.gstin.length >= 2 ? loc.gstin.substring(0, 2) : '');
    props.state.selectedConsignee.pin = loc.pincode || '';
    props.state.selectedConsignee.contact = loc.contact || props.state.selectedParty?.contact || '';
  }
}

function handleConsigneeToggle() {
  if (props.state.consigneeSameAsBillTo) {
    props.state.selectedConsignee = buildConsigneeFromParty();
    return;
  }
  ensureConsignee();
  nextTick(() => {
    const firstShipInput = partyPanelRef.value?.querySelector('.ship-fields input') as HTMLElement;
    firstShipInput?.focus();
  });
}

function ensureConsignee() {
  if (props.state.selectedConsignee) return;
  props.state.selectedConsignee = buildConsigneeFromParty();
}

function buildConsigneeFromParty() {
  return {
    name: props.state.selectedParty?.name || props.state.selectedParty?.firm || '',
    address: props.state.selectedPartyLocation?.address || props.state.selectedParty?.address || '',
    gstin: props.state.selectedPartyLocation?.gstin || props.state.selectedParty?.gstin || 'UNREGISTERED',
    state: props.state.selectedPartyLocation?.state || props.state.selectedParty?.state || '',
    stateCode: props.state.selectedPartyLocation?.stateCode || props.state.selectedParty?.stateCode || '',
    pin: props.state.selectedPartyLocation?.pincode || props.state.selectedParty?.pin || '',
    contact: props.state.selectedPartyLocation?.contact || props.state.selectedParty?.contact || '',
    deliveryInstructions: props.state.selectedConsignee?.deliveryInstructions || ''
  };
}

function getEnclosingContainer(e: KeyboardEvent): HTMLElement | null {
  const target = e.target as HTMLElement;
  return (target && target.closest('.invoice-page')) as HTMLElement || (target && target.closest('.side-panel')) as HTMLElement || partyPanelRef.value;
}

function onInputEnter(e: KeyboardEvent) {
  const container = getEnclosingContainer(e);
  if (container) {
    handleEnterKey(e, container);
  }
}

function onTextareaEnter(e: KeyboardEvent) {
  if (e.shiftKey) return;
  e.preventDefault();
  const container = getEnclosingContainer(e);
  if (container) {
    handleEnterKey(e, container);
  }
}

function onInputBackspace(e: KeyboardEvent) {
  const container = getEnclosingContainer(e);
  if (container) {
    handleBackspaceKey(e, container);
  }
}
</script>

<style scoped>
.party-panel {
  background: white;
  border: 0;
  border-bottom: 1px solid #dbe3ee;
  border-radius: 0;
  padding: 12px;
}
.panel-head,
.party-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.eyebrow {
  margin: 0 0 3px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-size: 13px;
  color: #0f172a;
  font-weight: 850;
}
.link-btn,
.change-btn {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: white;
  color: #2563eb;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.link-btn:hover,
.change-btn:hover {
  background: #f0f7ff;
}
.empty-party {
  width: 100%;
  min-height: 92px;
  margin-top: 10px;
  border: 2px dashed #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}
.empty-party:hover {
  border-color: #2563eb;
  background: #f0f7ff;
}
.empty-party span {
  font-size: 13px;
  font-weight: 800;
  color: #2563eb;
}
.empty-party small {
  font-size: 11px;
  color: #64748b;
}
.selected-party {
  margin-top: 10px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.selected-party h3 {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
.balance-badge {
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 1.5px 6px;
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.dr-badge {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.cr-badge {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.nil-badge {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
.gst-selector-container,
.party-branch-picker {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #cbd5e1;
}
.gst-select-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gst-select-label span {
  font-size: 9px;
  font-weight: 800;
  color: #2563eb;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.gst-select {
  width: 100%;
  height: 28px;
  border: 1px solid #93c5fd;
  background: white;
  color: #0f172a;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  outline: none;
}
.party-meta {
  margin: 8px 0 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
}
.party-meta dt {
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.party-meta dd {
  margin: 0;
  color: #334155;
  font-weight: 600;
}
.party-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.party-meta-row dt,
.party-meta-row dd {
  margin: 0;
}
.state-val {
  font-weight: 750;
  color: #1e293b;
  font-size: 11px;
}
:global(.dark) .state-val {
  color: #f1f5f9;
}
.party-meta-row.address-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.address-val {
  font-size: 10.5px;
  line-height: 1.35;
  color: #475569;
  font-weight: 500;
}
:global(.dark) .address-val {
  color: #94a3b8;
}
.closing-bal-val {
  display: inline-flex;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 800;
  font-size: 11px;
  padding: 1.5px 7px;
  border-radius: 4px;
  line-height: 1.2;
}
.closing-bal-val.bal-dr {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.closing-bal-val.bal-cr {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.closing-bal-val.bal-nil {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
:global(.dark) .closing-bal-val.bal-dr {
  background: rgba(180, 83, 9, 0.2);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.35);
}
:global(.dark) .closing-bal-val.bal-cr {
  background: rgba(4, 120, 87, 0.2);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.35);
}
:global(.dark) .closing-bal-val.bal-nil {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border-color: rgba(255, 255, 255, 0.12);
}
.consignee-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}
.same-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
}
.ship-fields {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ship-fields label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ship-fields span {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}
.ship-fields input,
.ship-fields textarea {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 700;
  outline: none;
}
.ship-fields input:focus,
.ship-fields textarea:focus {
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.ship-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
</style>
