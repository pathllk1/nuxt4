<template>
  <section class="party-panel">
    <header class="panel-head">
      <div>
        <p class="eyebrow">Party</p>
        <h2>{{ title }}</h2>
      </div>
      <button v-if="!state.isReturnMode" class="link-btn" type="button" @click="$emit('create-party')">
        New
      </button>
    </header>

    <button v-if="!state.selectedParty" class="empty-party" type="button" @click="$emit('open-modal')">
      <span>Select party</span>
      <small>{{ emptySubtitle }}</small>
    </button>

    <div v-else class="selected-party">
      <div class="party-title-row">
        <div class="min-w-0">
          <h3>{{ state.selectedParty.name }}</h3>
          <p>{{ state.selectedPartyGstin || 'UNREGISTERED' }}</p>
        </div>
        <button v-if="!state.isReturnMode" class="change-btn" type="button" title="Change party" @click="$emit('open-modal')">
          Change
        </button>
      </div>

      <!-- GST Location Selector -->
      <div v-if="state.gstEnabled && state.selectedParty?.gstLocations?.length > 1" class="gst-selector-container">
        <label class="gst-select-label">
          <span>Billing to GSTIN</span>
          <select 
            :value="state.selectedPartyLocation?.gstin || state.selectedPartyGstin || ''" 
            @change="onPartyGstinChange" 
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
        <div>
          <dt>State</dt>
          <dd>{{ state.selectedPartyLocation?.state || state.selectedParty.state || '-' }}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{{ state.selectedPartyLocation?.address || state.selectedParty.address || '-' }}</dd>
        </div>
      </dl>
    </div>

    <div class="consignee-block">
      <label class="same-toggle">
        <input v-model="state.consigneeSameAsBillTo" type="checkbox" @change="handleConsigneeToggle" />
        <span>Ship to billing address</span>
      </label>

      <div v-if="!state.consigneeSameAsBillTo && state.selectedConsignee" class="ship-fields">
        <label>
          <span>Consignee Name *</span>
          <input v-model="state.selectedConsignee.name" type="text" placeholder="Enter consignee name" />
        </label>
        <label>
          <span>Address *</span>
          <textarea v-model="state.selectedConsignee.address" rows="3" placeholder="Enter delivery address"></textarea>
        </label>
        <div class="ship-grid">
          <label v-if="state.gstEnabled">
            <span>GSTIN</span>
            <input v-model="state.selectedConsignee.gstin" type="text" maxlength="15" placeholder="27ABCDE1234F1Z5" />
          </label>
          <label :style="!state.gstEnabled ? 'grid-column: span 2;' : ''">
            <span>State *</span>
            <input v-model="state.selectedConsignee.state" type="text" placeholder="Enter state" />
          </label>
        </div>
        <div class="ship-grid">
          <label>
            <span>PIN Code</span>
            <input v-model="state.selectedConsignee.pin" type="text" maxlength="6" placeholder="PIN" />
          </label>
          <label>
            <span>Contact</span>
            <input v-model="state.selectedConsignee.contact" type="text" placeholder="Phone/Email" />
          </label>
        </div>
        <label>
          <span>Delivery Instructions</span>
          <textarea v-model="state.selectedConsignee.deliveryInstructions" rows="2" placeholder="Special delivery instructions"></textarea>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BillingState } from '@/composables/useBillingState';

const props = withDefaults(defineProps<{
  state: BillingState;
  title?: string;
  emptySubtitle?: string;
}>(), {
  title: 'Bill to',
  emptySubtitle: 'Customer or supplier record'
});

const emit = defineEmits(['open-modal', 'create-party', 'location-change']);

function onPartyGstinChange(event: Event) {
  const gstin = (event.target as HTMLSelectElement).value;
  const loc = props.state.selectedParty?.gstLocations?.find((l: any) => l.gstin === gstin) || null;
  props.state.selectedPartyLocation = loc;
  props.state.selectedPartyGstin = gstin || 'UNREGISTERED';
  emit('location-change');
}

function handleConsigneeToggle() {
  if (props.state.consigneeSameAsBillTo) {
    props.state.selectedConsignee = buildConsigneeFromParty();
    return;
  }
  ensureConsignee();
}

function ensureConsignee() {
  if (props.state.selectedConsignee) return;
  props.state.selectedConsignee = buildConsigneeFromParty();
}

function buildConsigneeFromParty() {
  return {
    name: props.state.selectedParty?.name || '',
    address: props.state.selectedPartyLocation?.address || props.state.selectedParty?.address || '',
    gstin: props.state.selectedPartyLocation?.gstin || props.state.selectedParty?.gstin || '',
    state: props.state.selectedPartyLocation?.state || props.state.selectedParty?.state || '',
    pin: props.state.selectedPartyLocation?.pincode || props.state.selectedParty?.pin || '',
    contact: props.state.selectedPartyLocation?.contact || props.state.selectedParty?.contact || '',
    deliveryInstructions: props.state.selectedConsignee?.deliveryInstructions || ''
  };
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
.empty-party {
  width: 100%;
  min-height: 92px;
  margin-top: 10px;
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  background: #f8fafc;
  color: #334155;
  display: grid;
  place-content: center;
  gap: 4px;
  cursor: pointer;
}
.empty-party span {
  font-weight: 850;
}
.empty-party small {
  color: #64748b;
}
.selected-party {
  margin-top: 14px;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #eff6ff;
  padding: 10px;
}
h3 {
  color: #172554;
  font-size: 13px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-party p {
  margin-top: 4px;
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 800;
}
.party-meta {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
}
.party-meta div {
  display: grid;
  gap: 2px;
}
dt {
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
dd {
  margin: 0;
  color: #1e293b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
}
.gst-selector-container {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #bfdbfe;
}
.gst-select-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gst-select-label span {
  color: #1e3a8a;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.gst-select {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 800;
  outline: none;
  background-color: white;
  color: #0f172a;
}
.gst-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.consignee-block {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5eaf1;
}
.same-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}
.same-toggle input {
  width: 15px;
  height: 15px;
}
.ship-fields {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.ship-fields label {
  display: grid;
  gap: 4px;
}
.ship-fields label span {
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
}
.ship-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ship-fields input,
.ship-fields textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  outline: none;
  resize: vertical;
}
.ship-fields input:focus,
.ship-fields textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
</style>
