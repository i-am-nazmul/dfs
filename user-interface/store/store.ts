import { create } from "zustand"


type Loader = {
  isLoading : boolean;
  setIsLoading : (value : boolean)=> void
}
const useIsLoading = create<Loader>((set)=>({
  isLoading : false,
  setIsLoading : (value)=>set({isLoading:value})
}))


export {
  useIsLoading
}