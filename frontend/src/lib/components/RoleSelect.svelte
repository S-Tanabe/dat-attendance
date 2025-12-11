<script lang='ts'>
	export let name: string = 'roleName'
	export let roles: { name: string, level: number, description: string }[] = []
	export let value: string = ''
	export let placeholder: string = '指定なし'
	export let disabled: boolean = false

	let open = false
	function select(val: string) {
		value = val
		open = false
	}
	$: label = value || placeholder
</script>

<div class='dropdown dropdown-bottom w-full' class:dropdown-open={open}>
	<button
		type='button'
		class='btn btn-outline w-full justify-between'
		class:btn-disabled={disabled}
		onclick={() => {
			if (disabled)
				return
			open = !open
		}}
		aria-haspopup='listbox'
		aria-expanded={open}
		aria-disabled={disabled}
		disabled={disabled}
	>
		<span class='capitalize'>{label || placeholder}</span>
		<svg width='16' height='16' viewBox='0 0 24 24' class='opacity-60'><path fill='currentColor' d='M7 10l5 5 5-5z' /></svg>
	</button>
	<ul
		class='dropdown-content menu bg-base-100 rounded-box z-[60] mt-2 w-full p-2 shadow'
		role='listbox'
	>
		<li>
			<button type='button' class='capitalize rounded-md' onclick={() => select('')}
				aria-label={placeholder}>{placeholder}</button>
		</li>
		{#each roles as r}
			<li>
				<button type='button' class='capitalize rounded-md' onclick={() => select(r.name)}>{r.name}</button>
			</li>
		{/each}
	</ul>
	<input type='hidden' name={name} value={value} />
</div>
