// Move existing controls rather than rebuilding them, preserving state and event handlers.
export function mountAppSettings({html,ipadHelp,offlinePanel,openSupport=false}){
 const panel=html('section',{id:'app-settings',class:'app-settings',hidden:'','aria-label':'Definições da app'}),heading=html('div',{class:'app-settings-heading'}),close=html('button',{type:'button',onclick:()=>setOpen(false)},'Fechar definições');heading.append(html('h2',{},'Definições da app'),close);panel.append(heading);
 const language=document.querySelector('.language-control');if(language)panel.append(language);
 const utility=document.querySelector('.utility');if(utility){const dirty=document.getElementById('dirty');if(dirty)document.querySelector('.layout-switch').append(dirty);panel.append(utility);}
 panel.append(ipadHelp,offlinePanel);const support=document.getElementById('apoios');if(support)panel.append(support);
 const note=document.querySelector('#view-physical>.footnote');if(note)panel.append(note);
 const trigger=html('button',{id:'app-settings-toggle',type:'button','aria-expanded':'false','aria-controls':'app-settings',onclick:()=>setOpen(panel.hidden)},'Definições da app');document.querySelector('.layout-switch').append(trigger);document.body.append(panel);
 function setOpen(value){panel.hidden=!value;trigger.setAttribute('aria-expanded',String(value));if(value)close.focus({preventScroll:true});else trigger.focus({preventScroll:true});}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();setOpen(false);}});
 if(openSupport)setOpen(true);
 return {panel,trigger};
}
