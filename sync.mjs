export function sameDump(first, second) {
  return !!first && !!second && first.length === second.length && first.every((v,i) => v === second[i]);
}

export function changedView(previous, current) {
  if (!previous || previous.name !== current.name || previous.scene !== current.scene || previous.superKnob !== current.superKnob || previous.motion !== current.motion) return 'performance';
  if(current.knobs?.some((k,i)=>k.value!==previous.knobs?.[i]?.value)) return 'performance';
  const effectChanged = ['reverb','variation'].some(key => previous[key]?.volume !== current[key]?.volume || previous[key]?.enabled !== current[key]?.enabled);
  const partEffectsChanged = current.parts.some(part => {
    const old=previous.parts.find(p=>p.index===part.index);
    return old && ['reverb','variation','insertion'].some(key=>old[key]!==part[key]);
  });
  if (effectChanged || partEffectsChanged) return 'effects';
  if(['volume','pan'].some(key=>previous[key]!==current[key]) || current.parts.some(part=>{
    const old=previous.parts.find(p=>p.index===part.index);
    return !old || ['volume','pan','mute','keyboard','low','high'].some(key=>old[key]!==part[key]);
  })) return 'performance';
  return null;
}

export function insertionValue(current, index, bit, enabled) {
  const part = current.parts.find(p => p.index === index);
  if (!part) throw new Error('A Part já não está disponível. Volta a ler o teclado.');
  return enabled ? part.insertion | bit : part.insertion & ~bit;
}
