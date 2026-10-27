export function ratingChoices(value = null) {
  return `<fieldset class="rating-picker"><legend>Your rating</legend><div class="rating-scale">${Array.from({ length: 10 }, (_, i) => {
    const score = (i + 1) / 2;
    return `<label class="rating-half ${i % 2 ? 'right-half' : 'left-half'}${value !== null && score <= value ? ' filled' : ''}"><input type="radio" name="rating" value="${score}" aria-label="${score} out of 5 stars" ${score === value ? 'checked' : ''}><span aria-hidden="true">★</span></label>`;
  }).join('')}</div><output class="rating-value">${value === null ? 'Not rated' : `${value} / 5`}</output></fieldset>`;
}
export function bindRatingPreview(form) {
  const picker=form.querySelector('.rating-picker');
  function preview(value){
    form.querySelectorAll('.rating-half').forEach((label,i)=>label.classList.toggle('filled',(i+1)/2<=value));
    form.querySelector('.rating-value').textContent=value ? `${value} / 5` : 'Not rated';
  }
  const restore=()=>preview(Number(form.querySelector('[name=rating]:checked')?.value)||0);
  form.querySelectorAll('[name=rating]').forEach(input=>{
    input.addEventListener('change',restore);
    input.addEventListener('focus',()=>preview(Number(input.value)));
    input.closest('label').addEventListener('mouseenter',()=>preview(Number(input.value)));
  });
  picker.addEventListener('mouseleave',restore);
  picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))restore();});
}
