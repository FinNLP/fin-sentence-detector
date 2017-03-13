import {Fin} from "finnlp";

/**
 * 
 * Calculate negation
 * 
**/
export function sentenceType(this:Fin.FinReturn){

	const interrogativeWTokens = ["which","who","what","whose","how","where"];
	const exclamatoryTokens = ["wow","ugh","oh"];
	const imperativeAUXTokens = ["can","could","would","will"];
	const beDerivatives = 	["be","been","being","was","am","is","are","were"];
	const haveDerivatives = ["have","had","had","has","having"];
	const didDerivatives = ["have","had","had","has","having"];
	const personalPronouns = ["i","you","he","she","it","we","they"];
	const auxVerbs = ([] as string[]).concat(beDerivatives,didDerivatives,haveDerivatives);

	const result:{
		type:string,
		confidence:number
	}[][] = [];

	this.sentences.forEach((sentence,sentenceIndex)=>{

		result[sentenceIndex][0] = {
			type:"interrogative",
			confidence:0
		};
		result[sentenceIndex][1] = {
			type:"imperative",
			confidence:0
		};
		result[sentenceIndex][2] = {
			type:"exclamatory",
			confidence:0
		};
		// remove this
		result[sentenceIndex][3] = {
			type:"declarative",
			confidence:0
		};

		// constraints:
		const tokens = this.tokens[sentenceIndex];
		const tags = this.tags[sentenceIndex];
		const deps = this.deps[sentenceIndex];
		const sentenceEndToken = tokens[tokens.length-1].toLowerCase();
		const sentenceBeforeEndToken = tokens[tokens.length-2].toLowerCase();
		const sentenceBeforeEndLabel = deps[deps.length-2].label;
		const sentenceStartToken = tokens[0].toLowerCase();
		const rootIndex = deps.findIndex(x=>x.parent === -1);
		const rootToken = tokens[rootIndex].toLowerCase();
		const rootTag = tags[rootIndex];
		const rootDirectChildren = deps
			.map((x,i)=>{
				return {
					tag:tags[i],
					token:tokens[i],
					label:x.label,
					parent:x.parent,
					index:i
				};
			})
			.filter(x=>x.parent === rootIndex);
		const rootSubject = rootDirectChildren.find(x=>x.label === "NSUBJ");
		const rootClausalComplement = rootDirectChildren.find(x=>x.label.endsWith("COMP"));
		const exclamatoryTokenIndex = tokens.map(x=>x.toLowerCase()).findIndex(x=>exclamatoryTokens.indexOf(x) > -1);
		const possibleAUXIndex = tokens.findIndex(x=>auxVerbs.indexOf(x.toLowerCase())>-1);

		// EXCLAMATORY
		// if it ends with ! and has a subject
		// (if it doesn't have a subject, then it might be imperative like: "do the dishes!")
		if(sentenceEndToken === "!" && rootSubject) {
			result[sentenceIndex][2].confidence = result[sentenceIndex][2].confidence + 70;
		}

		// EXCLAMATORY
		// if it has exclamatoryTokens before the root
		if(exclamatoryTokenIndex !== -1 && exclamatoryTokenIndex < rootIndex) {
			result[sentenceIndex][2].confidence = result[sentenceIndex][2].confidence + 30;
		}

		// ------------------------------------------

		// IMPERATIVE
		// "will you open the door for me?"
		// "can you send the email please"
		if(deps[0].label === "AUX" && imperativeAUXTokens.indexOf(sentenceStartToken) > -1) {
			result[sentenceIndex][1].confidence = result[sentenceIndex][1].confidence + 50;
		}

		// IMPERATIVE
		// root is a verb VBP or VB (at index 0 || or doesn't have a subject)
		// it's not "be" derivative like: "am I too early"
		// unless it's "be" in infinitive form
		if((rootTag === "VBP" || rootTag === "VB") && (rootIndex === 0 || (!rootSubject)) && beDerivatives.indexOf(rootToken) > 0) {
			result[sentenceIndex][1].confidence = result[sentenceIndex][1].confidence + 80;
		}

		// ------------------------------------------

		// interrogative:
		// any sentence that ends with "?"
		if(sentenceEndToken === "?") {
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 80;
		}

		// interrogative:
		// root is WP WP$ WRB like "What?"
		if(interrogativeWTokens.indexOf(rootToken) > -1) {
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 80;
		}

		// interrogative:
		// starts with an auxillary
		// but the root must have a subject
		if(deps[0].label === "AUX" && rootSubject) {
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 70;
		}

		// interrogative:
		// root is at 0 and it's "is" derivatives and doesn't have a subject
		// example: "am I too early"
		if(rootIndex === 0 && beDerivatives.indexOf(rootToken) > 2) {
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 70;
		}

		// interrogative
		// starts with interrogativeWTokens
		// and have an auxVerbs before the root
		// and doesn't have a clausal complement or the clausal complement isn't ["was","am","is","are","were"]
		if(
			interrogativeWTokens.indexOf(sentenceStartToken) > -1 && 
			possibleAUXIndex > -1 && 
			possibleAUXIndex < rootIndex &&
			((!rootClausalComplement) || beDerivatives.indexOf(rootClausalComplement.token) < 2)
		){
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 70;
		}

		// interrogative:
		// sentence ends with a personal pronoun
		// before the personal pronoun:
		//		- an auxVerbs
		// 		- clausal complement
		if(
			personalPronouns.indexOf(sentenceEndToken) > -1 &&
			auxVerbs.indexOf(sentenceBeforeEndToken) > -1 &&
			sentenceBeforeEndLabel.endsWith("COMP")
		){
			result[sentenceIndex][0].confidence = result[sentenceIndex][0].confidence + 70;
		}


		// finally, remove empty ones
		result[sentenceIndex] = result[sentenceIndex].filter(x=>x.confidence > 0);

		// make sure nothing surpasses 100
		result[sentenceIndex] = result[sentenceIndex].map((x)=>{
			if(x.confidence > 100) x.confidence = 100;
			return x;
		});

		// if nothing is found then it's declarative
		if(result[sentenceIndex].length === 0) {
			result[sentenceIndex].push({
				type:"declarative",
				confidence:80
			});
		}
	});
	return result;
}