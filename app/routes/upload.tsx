import { prepareInstructions } from "../../constants";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar"
import { convertPdfToImage } from "~/lib/pdf2img";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";

const Upload = () => {

    const {auth, ai, fs, kv, isLoading} = usePuterStore();

    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    }

    const handleAnalyze = async ({
        companyName,
        jobTitle,
        jobDescription,
        file
      }: {
        companyName: string,
        jobTitle: string,
        jobDescription: string,
        file: File
      }) => {
        setIsProcessing(true);
        setStatusText('Uploading file...');
      
        console.log("Step 1: Uploading resume PDF...");
        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) {
          console.error("❌ Error uploading resume file");
          return setStatusText('Error uploading file');
        }
        console.log("✅ Resume uploaded:", uploadedFile);
      
        setStatusText('Converting to image...');
        console.log("Step 2: Converting PDF to image...");
        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) {
          console.error("❌ Error converting PDF to image");
          return setStatusText('Error converting to image');
        }
        console.log("✅ PDF converted to image:", imageFile.file);
      
        setStatusText('Uploading the image...');
        console.log("Step 3: Uploading converted image...");
        const uploadedImage = await fs.upload([imageFile.file]);
        if (!uploadedImage) {
          console.error("❌ Error uploading image file");
          return setStatusText('Error uploading image');
        }
        console.log("✅ Image uploaded:", uploadedImage);
      
        setStatusText('Preparing data...');
        console.log("Step 4: Preparing data...");
        const uuid = generateUUID();
      
        const data = {
          id: uuid,
          resumePath: uploadedFile.path,
          imagePath: uploadedImage.path,
          companyName,
          jobTitle,
          jobDescription,
          feedback: '',
        };
        console.log("✅ Resume data prepared:", data);
      
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
      
        setStatusText('Analyzing...');
        console.log("Step 5: Sending data to AI for feedback...");
        const feedback = await ai.feedback(
          uploadedFile.path,
          prepareInstructions({ jobTitle, jobDescription }),
        );
      
        if (!feedback) {
          console.error("❌ Error analyzing resume");
          return setStatusText('Error: Failed to analyze resume');
        }
      
        const feedbackText = typeof feedback.message.content === 'string'
          ? feedback.message.content
          : feedback.message.content[0].text;
      
        data.feedback = JSON.parse(feedbackText);
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
      
        setStatusText('Analysis complete, redirecting...');
        console.log("✅ Analysis complete. Final data:", data);
      
        navigate(`/resume/${uuid}`);
      };
      

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string ;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;

        handleAnalyze({companyName, jobTitle, jobDescription, file});

    }

    return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
        <Navbar />
        <section className="main-section">
            <div className="page-heading py-16">
                <h1>Smart feedback for your dream job</h1>
                {isProcessing ? (
                    <>
                        <h2>{statusText}</h2>
                        <img src="/images/resume-scan.gif" alt="resume-scan" className="w-full" />
                    </>
                ) : (
                    <h2>Drop your resume for an ATS score and improvement tips</h2>
                )}
                {!isProcessing && (
                    <form action="" id="upload-form" className="flex flex-col gap-4 mt-8" onSubmit={handleSubmit}>
                        <div className="form-div">
                            <label htmlFor="company-name">Company Name</label>
                            <input type="text" name="company-name" id="company-name" placeholder="Comapany Name" /> 
                        </div>
                        <div className="form-div">
                            <label htmlFor="job-title">Job Title</label>
                            <input type="text" name="job-title" id="job-title" placeholder="Job Title" /> 
                        </div>
                        <div className="form-div">
                            <label htmlFor="job-description">Job Description</label>
                            <textarea rows={5} name="job-description" id="job-description" placeholder="Job Description" /> 
                        </div>
                        <div className="form-div">
                            <label htmlFor="uploader">Upload Resume</label>
                            <FileUploader onFileSelect={handleFileSelect}/>
                        </div>
                        <button className="primary-button" type="submit">Analyze Resume</button>
                    </form>
                )}
            </div>
        </section>
    </main>
}

export default Upload