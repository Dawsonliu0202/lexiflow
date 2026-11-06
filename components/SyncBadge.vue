<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium select-none"
    :class="badgeClasses"
    :title="title"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="dotClasses"></span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SyncStatus } from '../shared/types';

const props = defineProps<{
  status: SyncStatus;
  lastError?: string;
}>();

const label = computed(() => {
  switch (props.status) {
    case 'pending':
      return '待同步';
    case 'syncing':
      return '同步中';
    case 'synced':
      return '已同步';
    case 'failed':
      return '失败';
    default:
      return props.status;
  }
});

const title = computed(() => {
  if (props.status === 'failed' && props.lastError) {
    return `失败原因: ${props.lastError}`;
  }
  return label.value;
});

const badgeClasses = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'bg-[#faf1de] text-[#9a6a14]';
    case 'syncing':
      return 'bg-[#e8f0fa] text-[#2e5fa8]';
    case 'synced':
      return 'bg-[#e8f3ed] text-[#2f7d57]';
    case 'failed':
      return 'bg-[#fbebe9] text-[#b3382c]';
    default:
      return 'bg-gray-100 text-gray-700';
  }
});

const dotClasses = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'bg-[#9a6a14]';
    case 'syncing':
      return 'bg-[#2e5fa8] animate-ping';
    case 'synced':
      return 'bg-[#2f7d57]';
    case 'failed':
      return 'bg-[#b3382c]';
    default:
      return 'bg-gray-500';
  }
});
</script>
