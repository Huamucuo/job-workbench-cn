export async function measureAutomationPair({page,origin,definitions,compare,extensionFlow,coldStartupMs}){
 const measurements=[];
 for(const method of ['逐字段浏览器操作','真实扩展完整流程']){
  const started=performance.now();await page.goto(origin+'/ordinary.html');await page.waitForFunction(()=>typeof window.qaRead==='function');
  const expected=await definitions(page);const initialized=await page.evaluate(()=>window.qaRead());let filled=0;
  if(method==='逐字段浏览器操作'){
   for(const field of expected){if(field.policy!=='fill')continue;const loc=page.locator('[data-qa-key="'+field.key+'"]');
    if(field.type==='radio')await page.locator('[data-qa-key="'+field.key+'"][value="'+field.expected+'"]').check();
    else if(field.type==='checkbox'){for(const value of field.expected)await page.locator('[data-qa-key="'+field.key+'"][value="'+value+'"]').check();}
    else if(field.type==='select'||field.type==='multi-select')await loc.selectOption(field.expected);
    else await loc.fill(String(field.expected));filled++;
   }
  }else filled=await extensionFlow(page);
  const actual=await page.evaluate(()=>window.qaRead()),fields=compare(expected,actual),submits=await page.evaluate(()=>window.qaSubmits);
  const fullWorkflowMs=Math.round(performance.now()-started);measurements.push({method,fullWorkflowMs,coldStartupMs:Math.round(coldStartupMs),totalIncludingSharedColdStartupMs:Math.round(coldStartupMs+fullWorkflowMs),complete:fields.every(f=>f.correct),wrongFields:fields.filter(f=>!f.correct),submits,filled,initialized,fields});
 }
 const manual=measurements[0],extension=measurements[1];return {status:'MEASURED',verdict:measurements.every(r=>r.complete&&r.submits===0)?'PASS':'FAIL',humanTimingWaived:true,authorization:'User explicitly waived human timing on 2026-10-12; compare bounded automation methods without claiming human savings.',measurements,workflowRatio:extension.fullWorkflowMs/manual.fullWorkflowMs,workflowDifferenceMs:manual.fullWorkflowMs-extension.fullWorkflowMs,method:'Same original ordinary.html, same archived fictional profile, same initial values and protection/submit expectations. Both finish with identical whole-form independent comparisons. Shared browser/fixture cold startup measured once and explicitly included equally; not an independently repeated startup measurement.',limits:'Playwright field-by-field operations are automation, not human or AI reading speed. Real popup operations include unlock, recognition, all selected-row inspection, confirmation, filling, and final field comparison. UI readiness waits remain part of automation overhead. No delay is added to make either method look faster; one paired run is not a population benchmark.'};
}
