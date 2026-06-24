Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **NGS_240555** 

## **Final Report of** 

## **16S Metagenome Genome Sequencing** 

## **& Analysis on** 

## **Illumina Platform** 

## **Submitted to:** 

## **Sudharson Narayanan** 

## **Symbiont Life Sciences** 

## **India** 

## Submitted by: 

## **Unigenome** 

A life sciences division of Unipath Specialty Laboratory Ltd. 

3[rd] Floor, PASL House **|** Beside Sahjanand College **|** Panjara pol, Ambawadi, Ahmedabad – 380015 **|** Gujarat, India **|** Tel :- +91-79-66197701 genomics@unipath.in **|** www.unigenome.in 

Unigenome | Confidential Restricted use only 

1 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **Table of Contents** 

|**Table of Contents**|**Table of Contents**|
|---|---|
|1.<br>Project Details: ................................................................................................................................. 3||
|2.<br>Sample Details: ................................................................................................................................. 3||
|3.<br>Methods: ........................................................................................................................................... 3||
|3.1<br>Isolation and Quantitative analysis of DNA: ............................................................................... 3||
|3.2<br>Preparation of library: .................................................................................................................. 3||
|3.3<br>Quantity and quality check (QC) of library on Agilent Tape Station 4150: ................................ 4||
|3.4<br>Cluster Generation and Sequencing: ............................................................................................ 4||
|4.<br>Results: ............................................................................................................................................. 4||
|4.1<br>DNA QC on agarose gel .............................................................................................................. 4||
|4.2<br>Quantification by using Qubit® 4.0 Fluorometer ........................................................................ 5|Quantification by using Qubit® 4.0 Fluorometer ........................................................................ 5|
|5.<br>Quantity and quality check (QC) of library on Agilent Tape Station 4150 ...................................... 5||
|5.1<br>TapeStation 4150 profiles of library loaded in Agilent High Sensitivity D1000ScreenTape®: .. 5||
|6.<br>Wetlab inference: .............................................................................................................................. 5||
|7.<br>Data Generation ................................................................................................................................ 6||
|8.<br>Bioinformatics Analysis ................................................................................................................... 7||
|8.1<br>QIIME2 Overview and steps for 16S analysis ............................................................................. 7||
|8.2<br>Taxonomy Analysis ...................................................................................................................... 9||
|8.2.1<br>Feature summary ................................................................................................................ 9||
|8.2.2<br>Taxonomy Distribution: .................................................................................................... 10||
|8.3<br>Feature/OTU heatmap: .............................................................................................................. 12||
|8.4<br>α-Diversity ................................................................................................................................. 13||
|8.5<br>Rarefaction plot .......................................................................................................................... 14||
|8.6<br>Beta Diversity ............................................................................................................................ 15||
|8.7<br>Krona graph ............................................................................................................................... 17||
|9.<br>Data Deliverables ........................................................................................................................... 18|Data Deliverables ........................................................................................................................... 18|
|10.<br>Reference: ....................................................................................................................................... 22||



Unigenome | Confidential Restricted use only 2 

y Leading Genomic Innovations A Division of USLL Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 UNIGENOM= ) 

## **1. Project Details:** 

**Service Type** 16s Sequencing & Analysis on Illumina Platforms **Platform** Illumina Miseq platform **Read Length** 2 X 300 PE **Data** ~1,00,000 reads/sample 

## **2. Sample Details:** 

**Type of Sample** Root **No. of Samples** 7 **Sample Name** C-En, 4-En, 5-En, 8-En, 13-En, 17-En, 20-En **Shipping condition** NA **No. Of libraries prepared** 7 

## **3. Methods:** 

## **3.1 Isolation and Quantitative analysis of DNA:** 

DNA samples were extracted from root samples using CTAB DNA extraction method. DNA quantity was measured using Qubit® 4.0 fluorometer and DNA sample was amplified using 16s primer set and analyzed by gel electrophoresis. 

## **3.2 Preparation of library:** 

The V3-V4 (Product size ~459bp) region of 16s RNA gene was amplified using specific primers. PCR amplified product will be re-amplified using specific V3-F and V4-R primers with overhang adapter via PCR. 

**V3-F =16S Amplicon PCR Forward Primer** 

TCGTCGGCAGCGTCAGATGTGTATAAGAGACAGCCTACGGGNGGCWGCAG 

**V4-R =16S Amplicon PCR Reverse Primer** 

GTCTCGTGGGCTCGGAGATGTGTATAAGAGACAGGACTACHVGGGTATCTAATCC 

Unigenome | Confidential Restricted use only 

3 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 Afterwards, PCR products were purified by using Ampure XP beads. The purified amplicons were subjected to index PCR using Nextera XT indices kit. The resulting indexed amplicons were purified using AmPure XP beads and checked on Agilent tapestation. Libraries were quantified using Qubit HS and qPCR mix pooled together for sequencing. 

## **3.3 Quantity and quality check (QC) of library on Agilent Tape Station 4150:** 

The amplified libraries were analyzed on TapeStation 4150 (Agilent Technologies) using High Sensitivity D1000 ScreenTape® as per manufacturer's instructions. 

## **3.4 Cluster Generation and Sequencing:** 

The pooled PCR products (library) were loaded on sequencer for cluster generation by hybridization onto the oligonucleotide-coated surface of the flowcell. Immobilized DNA template copies were amplified by bridge amplification to generate clonal DNA clusters. Sequencing was performed using PE300 kit for sequencing of 16S sequencing on Miseq platform. 

## **4. Results:** 

## **4.1 DNA QC on 1.0% agarose gel** 

**Figure 1: QC of amplicons** 

|Lane id|Sample name|
|---|---|
|**1**|C En|
|**2**|4 En|
|**3**|5 En|
|**4**|8 En|
|**5**|13 En|
|**6**|17 En|
|**7**|20 En|
|**NC**|Negative Control|
|**PC**|Positive Control|
|**L**|100bpladder|



Unigenome | Confidential Restricted use only 

4 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **4.2 Quantification by using Qubit® 4.0 Fluorometer** 

|**S. N**|**Sample ID**|**Concentration (ng/µl)**|**Volume (µl )**|**Yield (ng)**|**Remarks**|
|---|---|---|---|---|---|
|1|C-En|41.6|20|832|QC PASS|
|2|4-En|34|20|680|QC PASS|
|3|5-En|41.4|20|828|QC PASS|
|4|8-En|40.4|20|808|QC PASS|
|5|13- En|39.6|20|792|QC PASS|
|6|17- En|40|20|800|QC PASS|
|7|20-En|40|20|800|QC PASS|



## **5. Quantity and quality check (QC) of library on Agilent Tape Station 4150** 

## **5.1 TapeStation 4150 profiles of library loaded in Agilent High Sensitivity D1000ScreenTape®:** 

**Figure 2: TapeStation 4150 profiles of 16s Pool** 

## **6. Wetlab inference:** 

- The libraries were prepared from the samples by using Nextera XT Indices kit. 

- The average size of library is 600bp for 16s pool. 

- The libraries were sequenced on Illumina Miseq platform (2 x 300 bp chemistry) to generate 

   - ~1,00,000 reads/sample. 

Unigenome | Confidential Restricted use only 

5 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **7. Data Generation** 

The data statistics of the reads obtained for each sample is provided in the below Table. 

**Table 1: Raw reads data statistics** 

|**Sample ID**|**PE seq**|**Total reads**<br>**(R1+R2)**|**Avg. read**<br>**len(bp)**|**Data (bp)**|**Data (MB)**|
|---|---|---|---|---|---|
|S13-En|1,39,588|2,79,176|301|84031976|84.03|
|S17-En|1,12,805|2,25,610|301|67908610|67.90|
|S20-En|1,81,292|3,62,584|301|109137784|109.13|
|S4-En|1,67,813|3,35,626|301|101023426|101.02|
|S5-En|1,75,032|3,50,064|301|105369264|105.36|
|S8-En|1,63,080|3,26,160|301|98174160|98.17|
|SC-En|1,87,852|3,75,704|301|113086904|113.08|



**Reads are provided in data deliverables folder “** _**00_Raw_data**_ **”. Data was filtered to remove adapter and low-quality reads. Clean high quality (HQ) reads thus obtained was used for analysis.** 

Unigenome | Confidential Restricted use only 

6 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8. Bioinformatics Analysis** 

## **8.1 QIIME2 Overview and steps for 16S analysis** 

Data was subjected to analysis by QIIME 2, which is an open-source microbiome data science platform. It is improved version of QIIME and it provides new features for analysis of the next generation of microbiome research. QIIME 2 is developed based on a plugin architecture that allows third parties to contribute functionality. QIIME 2 plugins exist for latest generation tools for sequence quality control from different sequencing platforms, taxonomy assignment, and phylogenetic insertion, that quantitatively improve results over QIIME and other tools. Plugins also support qualitatively new functionality including microbiome paired sample and time series analysis, critical for studying the impact of treatment on the microbiome, and for machine learning, including the ability to save trained models and apply them to new data and to interrogate models to identify important microbiome features. QIIME 2 provides many new interactive visualization tools facilitating exploratory analyses and result reporting. 

**Table 2: QIIME2 plugins used for Analysis** 

|**Plugin**|**Function**|
|---|---|
|**demux**|Plugin for demultiplexing & viewing sequence quality|
|**cutadapt**|Plugin for removing adapter sequences, primers, and other<br>unwanted sequence from sequence data|
|**vsearch**|Plugin for joining paired-end clustering and dereplicating with<br>vsearch|
|**quality-filter**|Plugin for PHRED-based filtering and trimming|
|**deblur**|Plugin for sequence quality control with Deblur|
|**feature-table**|Plugin for working with sample by feature tables|
|**feature-classifier**|Plugin for taxonomic classification|
|**taxa**|plugin provides functionality for working with and visualizing<br>taxonomic annotations of features|
|**fragment-insertion**|Plugin for extending phylogenies.|
|**diversity**|Plugin for exploring community diversity|
|**Q2-krona**|Plugin for plotting krona graph|



Unigenome | Confidential Restricted use only 7 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in 

NGS-240555 | Date: 30-10-25 

## **Below described are the steps executed during analysis through QIIME:** 

1. Importing of demultiplexed paired-end fastq data as QIIME 2 artifacts 

2. Joining of forward and reverse reads into single sequence 

3. Filtering of joined reads based on quality to remove low-quality reads 

4. Denoising the reads to correct it and get amplicon sequence variants (ASVs) with a 16S reference (88% OTUs from Greengenes 138) as a positive filter. The reference is only used to assess whether each sequence is likely to be 16S by a local alignment using SortMeRNA with a permissive e-value; the reference is not used to characterize the sequences 

5. Assigning taxonomy to ASVs against V3-V4 region of SILVA 138 database. Here, "classifysklearn" was used which is a pre-fitted sklearn-based taxonomy classifier 

6. Filtration of feature table to remove rare variants and contaminant (mitochondria) and unclassified ASVs as obtained after taxonomy assignment 

7. Generating stacked barchart of taxa relative abundances 

8. OTU heatmap generation at genus level 

9. Building a tree with SEPP method for placing short sequences into a reference phylogenetic tree 

10. Generating rarefaction curves to determine whether sufficient sequencing is done or not. 

11. Calculating alpha and beta diversity metrics (if more than 2 samples) 

12. Krona graph was then plotted using feature table and taxa information. 

Unigenome | Confidential Restricted use only 

8 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.2 Taxonomy Analysis** 

## **8.2.1 Feature summary** 

**Table 3: Feature summary** 

|**Sample ID**|**PE seq**|**Joined**<br>**filtered**<br>**reads**|**denoised**<br>**sequenced**<br>**(belonging to**<br>**OTUs)**|**Filtered**<br>**sequences***<br>**(belonging to**<br>**OTUs)**|**Filtered**<br>**feature**<br>**count/OTUs**|
|---|---|---|---|---|---|
|S13-En|139130|118422|48918|48833|607|
|S17-En|112453|95495|32650|32577|599|
|S20-En|180743|154495|51448|51387|566|
|S4-En|167310|143461|56594|56485|682|
|S5-En|174434|146839|45124|45081|389|
|S8-En|162623|137917|56197|56110|495|
|SC-En|187091|158258|56747|56655|780|



* Filtered sequences: Total sequences belonging to features remained after removing features consisting of single sequences as well as having mitochondrial hits. 

*Filtered feature count: Number of features remained after removing features consisting of single sequences as well as having mitochondrial hits. 

## **Further detail of above stats obtained can be found in data deliverables folders:** 

_**01 Cutadapt trimmed**_ 

_**02 PE Joined and filtered**_ 

_**03 Deblur denoised feature**_ 

_**04 deblur filter contam**_ 

Unigenome | Confidential Restricted use only 

9 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat 

Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.2.2 Taxonomy Distribution:** 

Taxonomy distribution has been shown just of phylum level in the below mentioned graph and the table. However, complete taxonomy distribution at Phylum, Class, Order, Family, genus, species has been provided in data deliverables folder “ _**05_Taxonomy_barplot**_ ”. 

**Figure 3: Comparative taxonomy at phylum level** 

**Note: Images of other taxonomies (i.e from phylum level to species level) can be visualized from "** _**05_Taxonomy_barplot/index.html**_ **". For changing the taxonomy level, change the level tab in the index.html.** 

Unigenome | Confidential Restricted use only 

10 

|**Phylum**|**SC-En**|**S13-En**|**S8-En S20-En**|**S8-En S20-En**|**S4-En**|**S5-En**|**S17-En**|
|---|---|---|---|---|---|---|---|
|**d__Bacteria;p__Firmicutes**|9399|3059|4413|6859|5997|10150|7548|
|**d__Bacteria;p__Proteobacteria**<br>~~ee~~|36698<br>~~ee~~|38684<br>~~ee~~|40751<br>~~ee~~|38360<br>~~ee~~|39927<br>~~ee~~|33590<br>~~ee~~|23386<br>~~ee~~|
|**d__Bacteria;p__Actinobacteriota**<br>~~GG~~|433<br>~~GG~~|172<br>~~GG~~|340<br>~~GG~~|143<br>~~GG~~|206<br>~~GG~~|1172<br>~~GG~~|111<br>~~GG~~|
|**d__Bacteria;p__Bacteroidota**<br>~~Pe~~|9411<br>~~Pe~~|6136<br>~~Pe~~|8929<br>~~Pe~~|5937<br>~~Pe~~|9447<br>~~Pe~~|126<br>~~Pe~~|1257<br>~~Pe~~|
|**d__Bacteria;p__Myxococcota**<br>~~se~~|0<br>~~se~~|24<br>~~se~~|49<br>~~se~~|4<br>~~se~~|18<br>~~se~~|2<br>~~se~~|2<br>~~se~~|
|**d__Bacteria;p__Chloroflexi**<br>~~se~~<br>~~se~~|19<br>~~se~~<br>~~se~~|7<br>~~se~~<br>~~se~~|6<br>~~se~~<br>~~se~~|13<br>~~se~~<br>~~se~~|18<br>~~se~~<br>~~se~~|9<br>~~se~~<br>~~se~~|32<br>~~se~~<br>~~se~~|
|**d__Bacteria;p__Fibrobacterota**<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|4<br>~~se~~<br>~~ee~~|
|**d__Bacteria;p__Bdellovibrionota**<br>~~SG~~|94<br>~~SG~~|166<br>~~GO~~|1160<br>~~GO~~|23<br>~~GO~~|602<br>~~GO~~|3|0|
|**d__Bacteria;p__Desulfobacterota**<br>~~SG~~|357<br>~~SG~~|4<br>~~SO~~|4<br>~~SO~~|0<br>~~SO~~|83|0|186|
|**d__Bacteria;p__Acidobacteriota**<br>~~SG~~<br>~~se~~|7<br>~~SG ~~<br>~~se~~|10<br> ~~SO~~<br>~~se~~|0<br>~~SO~~<br>~~se~~|24<br>~~SO~~<br>~~se~~|11<br>~~se~~|2<br>~~se~~|9<br>~~se~~|
|**d__Bacteria;p__Cyanobacteria**<br>~~se~~<br>~~se~~|18<br>~~se~~<br>~~se~~|490<br>~~se~~<br>~~se~~|388<br>~~se~~<br>~~se~~|2<br>~~se~~<br>~~se~~|57<br>~~se~~<br>~~se~~|4<br>~~se~~<br>~~se~~|6<br>~~se~~<br>~~se~~|
|**d__Bacteria;p__Verrucomicrobiota**<br>~~se~~<br>~~ee~~|96<br>~~se~~<br>~~ee~~|44<br>~~se~~<br>~~ee~~|49<br>~~se~~<br>~~ee~~|5<br>~~se~~<br>~~ee~~|75<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|4<br>~~se~~<br>~~ee~~|
|**d__Bacteria;__**<br>~~SG~~|33<br>~~SG ~~|0<br> ~~SD~~|0<br>~~SD~~|7<br>~~SD~~|0|2|0|
|**d__Archaea;p__Euryarchaeota**<br>~~SG~~|2<br>~~SG~~|4<br>~~OO~~|0<br>~~OO~~|0<br>~~OO~~|0|0|0|
|**d__Bacteria;p__Campilobacterota**<br>~~SG~~<br>~~se~~|6<br>~~SG ~~<br>~~se~~|0<br> ~~OO~~<br>~~se~~|0<br>~~OO~~<br>~~se~~|0<br>~~OO~~<br>~~se~~|0<br>~~se~~|0<br>~~se~~|0<br>~~se~~|
|**d__Bacteria;p__Patescibacteria**<br>~~se~~<br>~~se~~|72<br>~~se~~<br>~~se~~|29<br>~~se~~<br>~~se~~|3<br>~~se~~<br>~~se~~|5<br>~~se~~<br>~~se~~|0<br>~~se~~<br>~~se~~|0<br>~~se~~<br>~~se~~|20<br>~~se~~<br>~~se~~|
|**d__Bacteria;p__Deinococcota**<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|29<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|10<br>~~se~~<br>~~ee~~|
|**d__Bacteria;p__Sumerlaeota**<br>~~GO~~|0<br>~~GO~~|0<br>~~GO~~|16<br>~~GO~~|0<br>~~GO~~|6<br>~~GO~~|0<br>~~GO~~|0<br>~~GO~~|
|**d__Archaea;p__Halobacterota**<br>~~SG~~|0<br>~~SG~~|0<br>~~OO~~|0<br>~~OO~~|2<br>~~OO~~|0|2|2|
|**d__Bacteria;p__Armatimonadota**<br>~~SG~~<br>~~se~~|8<br>~~SG ~~<br>~~se~~|0<br> ~~OO~~<br>~~se~~|0<br>~~OO~~<br>~~se~~|0<br>~~OO~~<br>~~se~~|0<br>~~se~~|0<br>~~se~~|0<br>~~se~~|
|**d__Bacteria;p__Planctomycetota**<br>~~se~~<br>~~ee~~|2<br>~~se~~<br>~~ee~~|4<br>~~se~~<br>~~ee~~|2<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|2<br>~~se~~<br>~~ee~~|0<br>~~se~~<br>~~ee~~|
|**d__Archaea;p__Crenarchaeota**<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|3<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|
|**d__Bacteria;p__Fusobacteriota**<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|0<br>~~ee~~|9<br>~~ee~~|17<br>~~ee~~|0<br>~~ee~~|



**Note: Compiled pylum, class, order, family, genus, species count is provided in data deliverables excel file: level-2_taxa, level-3_taxa, level-4_taxa, level-5_taxa, level-6_taxa, level-7_taxa corresponding to phylum, class, order, family, genus, species respectively in folder "** _**05_Taxonomy_barplot**_ **”.** 

Unigenome | Confidential Restricted use only 

11 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 **Feature/OTU heatmap:** Feature-table plugging having heatmap module was used for generation of feature heatmap. For this, feature table was first collapsed at genus level. Heatmap representation of a feature table with clustering on features and samples axes was done after normalizing the feature table by adding a pseudo count of 1 and then taking the log10 of the table. Feature heatmap at different sequence cutoff is provided in data deliverables entitled _**"06_Feature_heatmap".**_ **However, one heatmap of OTUs having minimum 500 sequence is provided in figure below for visualization purpose:** 

## **8.3 Feature/OTU heatmap:** 

**Figure 4 : OTU/feature heatmap** 

Unigenome | Confidential Restricted use only 

12 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.4 α-Diversity** 

α-Diversity or within-sample diversity is calculated using a feature table which gives idea about species richness. Alpha diversity summarizes the diversity of organisms in a sample with a single number using different metrics in a habitat/sample. The below table summarizes the α-Diversity, where the columns correspond to alpha diversity metrics and the rows correspond to samples and their calculated diversity measurements. Data Deliverables for the same are provided entitled 

_**"08_Alpha_diversity".**_ 

## **Table 5: Alpha-diversity** 

|**SampleID**|**chao1**|**shannon_entropy observed_features**|**observed_features**|
|---|---|---|---|
|**S13-En**|607.3979592|5.178711115|607|
|**S17-En**|600.7759563|5.008140815|599|
|**S20-En**|567.6140351|5.570670292|566|
|**S4-En**|682.9952607|6.151116162|682|
|**S5-En**|389.3982301|4.519957071|389|
|**S8-En**|495.8888889|4.900942795|495|
|**SC-En**|781.6223176|6.344051842|780|



**Figure 5 : Alpha-diversity** 

Unigenome | Confidential Restricted use only 

13 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat 

Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.5 Rarefaction plot** 

Rarefaction allows the calculation of species richness for a given number of individual samples, based on the construction of so-called rarefaction curves. This curve is a plot of the number of species as a function of the number of samples. On the left, the steep slope indicates that a large fraction of the species diversity remains to be discovered. The vertical axis displays the diversity of the community, while the horizontal axis displays the number of sequences considered in the diversity calculation. HTML file for rarefaction analysis is provided in data deliverables folder entitled **"** _**09_Rarefaction_curve". Below provided graph is generated by selecting “Description” in dropdown menu of sample metadata column and “observed_Features” in metric.**_ 

**Figure 6 : Rarefaction plot** 

Unigenome | Confidential Restricted use only 

14 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.6 Beta Diversity** 

Beta diversity represents the explicit comparison of microbial communities based on their composition Beta-diversity metrics thus assess the differences between microbial communities. The fundamental output of these comparisons is a square distance matrix where a “distance” or dissimilarity is calculated between every pair of community samples, reflecting the difference in microbial composition between those samples. Beta diversity can be calculated through different statistical methods. The non-phylogenetic based metrics used in for analysis were **bray curtis** and **jaccard** whereas phylogenetic based matrix used were **non-weighted** and **unweighted. Results obtained from all metrics is provided data deliverables folder** _**“10_Beta_diversity”**_ . However, result obtained for bray curtis is shown in table and figure below: 

**Table 6: Bray Curtis Distance matrix** 

||**SC-En**|**S13-En**|**S8-En**|**S20-En**|**S4-En**|**S5-En**|**S17-En**|
|---|---|---|---|---|---|---|---|
|**SC-En**|0|0.737422108|0.753814041|0.634772999|0.662553335|0.949135893|0.63784265|
|**S13-En**|0.737422108|0|0.848389968|0.787764374|0.779813979|0.943579826|0.814194063|
|**S8-En**|0.753814041|0.848389968|0|0.870153789|0.796451484|0.923013169|0.771618013|
|**S20-En**|0.634772999|0.787764374|0.870153789|0|0.662215674|0.900052184|0.760536575|
|**S4-En**|0.662553335|0.779813979|0.796451484|0.662215674|0|0.879301348|0.71369371|
|**S5-En**|0.949135893|0.943579826|0.923013169|0.900052184|0.879301348|0|0.955305891|
|**S17-En**|0.63784265|0.814194063|0.771618013|0.760536575|0.71369371|0.955305891|0|



Unigenome | Confidential Restricted use only 

15 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

**Figure 7: Principal Coordinates plot for samples. The first three principal axes are shown.** 

**Principal coordinate analysis is based on bray Curtis distance matrix for different samples** 

**Note: Emperor plot visualization can be switched by changing the option “scatter” from color tab provided on right-hand side bar. Result for all 4 matrix namely, bray curtis, jaccard, non-weighted and unweighted are provided in data deliverables folder “** _**10_Beta_diversity**_ **”.** 

Unigenome | Confidential Restricted use only 

16 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **8.7 Krona graph** 

Krona is an interactive visualization tool for exploring the composition of metagenomes within a Web browser. Krona allows hierarchical metagenome data to be explored with zooming, multilayered pie charts. Krona graph was generated from feature table and taxonomy assigned by qiime2. **Krona for one of the sample is given in figure below for species taxonomy. However, krona for all samples is provided as a part of data deliverables folder** _**“11_Krona_graph/index.html”.**_ **The taxa level can be changed using “Max_depth” column for phylum (max depth: 2) to species (max depth: 7).** 

**Figure 8: Krona graph for sample “S13-En”** 

Unigenome | Confidential Restricted use only 

17 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

## **9. Data Deliverables** 

**==> picture [247 x 574] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|├── 00_Raw_Data|
|│|├── 240555_13_En_S96_R1_001.fastq.gz|
|│|├── 240555_13_En_S96_R2_001.fastq.gz|
|│|├── 240555_17_En_S97_R1_001.fastq.gz|
|│|├── 240555_17_En_S97_R2_001.fastq.gz|
|│|├── 240555_20_En_S98_R1_001.fastq.gz|
|│|├── 240555_20_En_S98_R2_001.fastq.gz|
|│|├── 240555_4_En_S93_R1_001.fastq.gz|
|│|├── 240555_4_En_S93_R2_001.fastq.gz|
|│|├── 240555_5_En_S94_R1_001.fastq.gz|
|│|├── 240555_5_En_S94_R2_001.fastq.gz|
|│|├── 240555_8_En_S95_R1_001.fastq.gz|
|│|├── 240555_8_En_S95_R2_001.fastq.gz|
|│|├── 240555_C_En_S92_R1_001.fastq.gz|
|│|├── 240555_C_En_S92_R2_001.fastq.gz|
|│|├── data_stats.txt|
|│|└── md5sum.txt|
|├── 01_Cutadapt_trimmed|
|│|├── Trimmed_reads|
|│|└── Trimmed_reads_summary|
|├── 02_PE_Joined_and_filtered|
|│|├── PE_joined_filtered_reads|
|│|└── PE_joined_filtered_reads_summary|
|├── 03_Deblur_denoised_feature|
|│|├── css|
|│|├── feature-frequencies.pdf|
|│|├── feature-frequencies.png|
|│|├── feature-frequency-detail.csv|

**----- End of picture text -----**<br>


Unigenome | Confidential Restricted use only 

18 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

│ ├── feature-frequency-detail.html │ ├── index.html │ ├── js │ ├── licenses │ ├── q2templateassets │ ├── sample-frequencies.pdf │ ├── sample-frequencies.png │ ├── sample-frequency-detail.csv │ ├── sample-frequency-detail.html │ └── util.js ├── 04_Deblur_filter_contam │ ├── css │ ├── feature-frequencies.pdf │ ├── feature-frequencies.png │ ├── feature-frequency-detail.csv │ ├── feature-frequency-detail.html │ ├── index.html │ ├── js │ ├── licenses │ ├── q2templateassets │ ├── sample-frequencies.pdf │ ├── sample-frequencies.png │ ├── sample-frequency-detail.csv │ ├── sample-frequency-detail.html │ └── util.js ├── 05_Taxonomy_barplot │ ├── dist │ ├── index.html │ ├── level-1.csv 

Unigenome | Confidential Restricted use only 19 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

**==> picture [160 x 594] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|│|├── level-1.jsonp|
|│|├── level-1_taxa.csv|
|│|├── level-2.csv|
|│|├── level-2.jsonp|
|│|├── level-2_taxa.csv|
|│|├── level-3.csv|
|│|├── level-3.jsonp|
|│|├── level-3_taxa.csv|
|│|├── level-4.csv|
|│|├── level-4.jsonp|
|│|├── level-4_taxa.csv|
|│|├── level-5.csv|
|│|├── level-5.jsonp|
|│|├── level-5_taxa.csv|
|│|├── level-6.csv|
|│|├── level-6.jsonp|
|│|├── level-6_taxa.csv|
|│|├── level-7.csv|
|│|├── level-7.jsonp|
|│|├── level-7_taxa.csv|
|│|└── q2templateassets|
|├── 06_Feature_heatmap|
|│|├── heatmap|
|│|├── heatmap_OTU100|
|│|├── heatmap_OTU200|
|│|└── heatmap_OTU500|
|├── 07_Repset_and_biom|
|│|├── dna-sequences.fasta|
|│|├── feature-table.biom|

**----- End of picture text -----**<br>


Unigenome | Confidential Restricted use only 20 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

│ ├── feature-table_w_tax.biom │ └── feature-table_w_tax.txt ├── 08_Alpha_diversity │ ├── alpha_diversity_plot.pdf │ ├── chao1 │ ├── observed_otus_vector │ └── shannon_vector ├── 09_Rarefaction_curve │ ├── dist │ ├── faith_pd-BarcodeSequence.jsonp │ ├── faith_pd.csv │ ├── faith_pd-Description.jsonp │ ├── faith_pd-LinkerPrimerSequence.jsonp │ ├── index.html │ ├── observed_features-BarcodeSequence.jsonp │ ├── observed_features.csv │ ├── observed_features-Description.jsonp │ ├── observed_features-LinkerPrimerSequence.jsonp │ ├── q2templateassets │ ├── shannon-BarcodeSequence.jsonp │ ├── shannon.csv │ ├── shannon-Description.jsonp │ └── shannon-LinkerPrimerSequence.jsonp ├── 10_Beta_diversity │ ├── bray_curtis_distance_matrix │ ├── bray_curtis_emperor │ ├── bray_curtis_pcoa_results │ ├── jaccard_distance_matrix │ ├── jaccard_emperor 

Unigenome | Confidential Restricted use only 21 

Lab Facility: 2A,3A,3B PASL -House, Beside Sahjanand college, Opposite Kamdenu Complex, Panjarapole, Ambawadi, Ahmedabad-380015, Gujarat Ph+91-79-49006800 | WhatsApp: 6356005900 | Email:info@unigenome.in | Website: www.unigenome.in NGS-240555 | Date: 30-10-25 

│ ├── jaccard_pcoa_results 

│ ├── unweighted_unifrac_distance_matrix 

│ ├── unweighted_unifrac_emperor 

│ ├── unweighted_unifrac_pcoa_results 

│ ├── weighted_unifrac_distance_matrix 

│ ├── weighted_unifrac_emperor 

│ └── weighted_unifrac_pcoa_results ├── 11_Krona_graph │ ├── index.html │ ├── q2templateassets │ ├── S13-En.txt │ ├── S17-En.txt │ ├── S20-En.txt │ ├── S4-En.txt │ ├── S5-En.txt │ ├── S8-En.txt │ └── SC-En.txt ├── folder_explanation.xlsx └── Readme.txt 

## **└── NGS_240555_Final_Report_16S_metagenome_30.10.25.pdf** 

## **10. Reference:** 

Bolyen, Evan, et al. "Reproducible, interactive, scalable and extensible microbiome data science using QIIME 2." Nature biotechnology 37.8 (2019): 852-857. 

## **[END OF REPORT]** 

Unigenome | Confidential Restricted use only 

22 

