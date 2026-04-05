"use client" 
export default function SignupPage() {
	return (
		<main className="min-h-screen bg-[#e6e6e6] px-4 py-4 md:px-5 md:py-3">
			<h1 className="text-[62px] leading-none font-extrabold text-[#2f3b53]">SignUp</h1>

			<div className="mx-auto mt-[220px] flex w-full max-w-[430px] flex-col items-center">
				<div className="flex w-[290px] flex-col gap-1.5">
					<input
						type="text"
						placeholder="Enter the username"
						className="h-[52px] rounded-[3px] border border-[#b7a969] bg-[#ecd97f] px-3 text-[31px] font-normal text-[#6f6f55] outline-none placeholder:text-[#6f6f55]"
					/>
					<input
						type="email"
						placeholder="Enter the email"
						className="h-[52px] rounded-[3px] border border-[#b7a969] bg-[#ecd97f] px-3 text-[31px] font-normal text-[#6f6f55] outline-none placeholder:text-[#6f6f55]"
					/>
					<input
						type="password"
						placeholder="Enter the password"
						className="h-[52px] rounded-[3px] border border-[#b7a969] bg-[#ecd97f] px-3 text-[31px] font-normal text-[#6f6f55] outline-none placeholder:text-[#6f6f55]"
					/>

					<button
						type="button"
						className="mt-1.5 mx-auto h-[56px] rounded-[8px] bg-[#00594f] px-4 text-[47px] leading-none font-normal text-white"
					>
						Signup
					</button>
				</div>

				<button
					type="button"
					className="mt-4 rounded-[8px] bg-[#00594f] px-3 py-0.5 text-[38px] leading-none font-bold text-white"
				>
					Already have an account ? Login Instead
				</button>
			</div>
		</main>
	);
}
